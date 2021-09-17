const schedule = require('node-schedule');
const axios = require('axios');

const infra_url = process.env.INFRA_URL;
const resourceChecker_url = process.env.RESOURCE_CHECKER_URL || 'http://localhost:5000';

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

module.exports = {
    compileCode,
    runMatch
}
