const schedule = require('node-schedule');
const axios = require('axios');
const fs = require('fs');

const infra_url = process.env.INFRA_URL;
const resourceChecker_url = process.env.RESOURCE_CHECKER_URL || 'http://localhost:5000';
const uploadRootDir = process.env.UPLOAD_ROOT_DIR || `${__dirname}/uploads`;
const backendUrl = process.env.BACKEND_URL || 'http://localhost:8000';

const resourceChecker = mode => {
    return axios.get(`${resourceChecker_url}/ok/`);
};

const compileCode = (_id, code) => {
    resourceChecker('COMPILE')
    .then(ans => {
        const haveResource = ans.data.toString() === 'OK';
        if (haveResource) {
            console.log('Compiling code...');
            console.log(_id, code);
            axios.post(`${infra_url}/deployment/compile/`, {
                _id: _id,
                code_folder_name: code
            }).then(result => {
                console.log(result);
            }).catch(err => {
                console.error(err);
            });
        } else {
            console.log('No Resource for compile...');
            const currentDate = new Date();
            const futureDate = new Date(currentDate.getTime() + (60 * 1000) + Math.random() * 10);
            schedule.scheduleJob(futureDate, () => compileCode(_id, code));
        }
    }).catch(err => {
        console.log(err);
    });
    
}

const runMatch = (match_id, team1, code1, type1, team2, code2, type2) => {
    resourceChecker('MATCH')
    .then(ans => {
        const haveResource = ans.data.toString() === 'OK';
        if (haveResource) {
            console.log('Running match...');
            console.log(match_id, team1, code1, type1, team2, code2, type2);
            axios.post(`${infra_url}/deployment/run_match/`, {
                match_id: match_id,
                team1_file_name: code1,
                team1_name: team1,
                team1_type: type1,
                team2_file_name: code2,
                team2_name: team2,
                team2_type: type2
            }).then(result => {
                console.log(result);
            }).catch(err => {
                console.error(err);
            });
        } else {
            console.log('No Resource for match...');
            const currentDate = new Date();
            const futureDate = new Date(currentDate.getTime() + (120 * 1000) + Math.random() * 10);
            schedule.scheduleJob(futureDate, () => runMatch(_id, code));
        }
    }).catch(err => {
        console.log(err);
    });
    
}

const saveMatchResult = async(matchRecord) => {
    try{
        matchRecord.status = 'finished';
        const gameLog = fs.readFileSync(`${uploadRootDir}/logs/${matchRecord._id}/game.json`);
        const serverLog = fs.readFileSync(`${uploadRootDir}/logs/${matchRecord._id}/server.log`);
        const gameJson = JSON.parse(gameLog);
        matchRecord.winner = gameJson["initial_game_data"].winnerId - 1;
        await matchRecord.save();
        if(matchRecord.isFriendly) {
            axios.post(`${backendUrl}/match/match-result-friendly/`, {
                code_id: matchRecord.winner,
                match_result_id: matchRecord.game_id,
                server_hash: Buffer.from(serverLog.toString()).toString('base64'),
                game_hash: Buffer.from(gameLog.toString()).toString('base64'),
                key_secret: process.env.KEY_SECRET
            }).then(_ => {
                console.log('OK');
            }).catch(err => {
                console.log(err);
            });
        }
    }catch(e) {
        await axios.post(process.env.WEBHOOKURL, {
            content: `Internal Micro error ${e}`
        });
    }
}

module.exports = {
    compileCode,
    runMatch,
    saveMatchResult
}
