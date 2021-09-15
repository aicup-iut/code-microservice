const express = require('express');
const fileUpload = require('express-fileupload');
const mongoose = require('mongoose');
const axios = require('axios');
const fs = require('fs');
const logger = require('morgan');
const unzipper = require('unzipper');

const Code = require("./models/Code");
const Match = require("./models/Match");
const { compileCode, runMatch } = require("./utils");

const app = express();
const port = process.env.PORT || 3000;
const backendUrl = process.env.BACKEND_URL || 'http://localhost:8000';
const uploadRootDir = process.env.UPLOAD_ROOT_DIR || `${__dirname}/uploads`;
const db_user_name = process.env.MONGO_INITDB_ROOT_USERNAME || 'root';
const db_password = process.env.MONGO_INITDB_ROOT_PASSWORD || 'root';
const db_name = process.env.DB_NAME || 'aicup';
const db_host = process.env.DB_HOST || 'localhost';
const db_port = process.env.DB_PORT || 4040;
const connectionString = `mongodb://${db_user_name}:${db_password}@${db_host}:${db_port}/${db_name}?authSource=admin`;

app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get('/', (_, res) => {
    res.end('Hello World!');
});

app.post('/submit', fileUpload({
    limits: { fileSize: 16 * 1024 * 1024 }
}), (req, res) => {
    if (!req.files || Object.keys(req.files).length === 0) {
        return res.status(400).send('No files were uploaded.');
    }
    if(!req.body.teamName) {
        return res.status(400).send('Team name is required.');
    }
    const codeFile = req.files.file;
    const fileExtension = codeFile.name.split('.').pop();
    if(fileExtension !== 'zip') {
        return res.status(400).send('Invalid file extension.');
    }
    const uniqueId = new Date().getTime().toString() + '-' + Math.floor(Math.random() * 1000).toString();
    const newFileName = uniqueId + '.zip';
    const uploadPath = `${uploadRootDir}/tmp/${newFileName}`;
    fs.mkdirSync(`${uploadRootDir}/codes/${uniqueId}`);
    const workingDir = `${uploadRootDir}/codes/${uniqueId}/input`;
    fs.mkdirSync(workingDir);
    fs.mkdirSync(`${uploadRootDir}/codes/${uniqueId}/output`);
    codeFile.mv(uploadPath, (err) => {
        if (err) {
            return res.status(500).send(err);
        }
        fs.createReadStream(uploadPath)
        .pipe(unzipper.Extract({ path: workingDir }))
        .on('close', () => {
            fs.readdir(workingDir, (err, files) => {
                if (err) {
                    return res.status(500).send(err);
                }
                let len = files.length;
                let model = false;
                let lang = 'None';
                files.forEach(file => {
                    if(!(file === 'main.cpp' || file === 'main.py' || file === 'main.java' || file === 'model')){
                        fs.rmSync(`${workingDir}/${file}`);
                        len--;
                    }else {
                        if(file == 'model') model = true;
                        else {
                            if(lang !== 'None') len = -1000; //to generate error
                            lang = file.split('.').pop();
                        }
                    }
                });
                if((len < 1 || len > 2) || (len === 1 && model))
                    return res.status(400).send('Invalid file structure.');
                //Finally save the data
                const code = new Code({
                    team: req.body.teamName,
                    code: uniqueId,
                    lang: lang
                });
                code.save().then(_doc => {
                    const _id = _doc._id.toString();
                    compileCode(_id, uniqueId);
                    res.end(_id);
                }).catch((err) => {
                    res.status(500).send(err);
                });
                fs.rmSync(uploadPath);
            });
        });
    });
});

app.post('/compile-result', (req, res) => {
    if(!req.body._id) {
        return res.status(400).send('_id is required.');
    }
    if(!req.body.compile_status) {
        return res.status(400).send('compile_status is required.');
    }
    const _id = req.body._id;
    const compile_status = req.body.compile_status;
    const compile_message = req.body.compile_message;
    Code.findByIdAndUpdate(_id, {
        compile_status,
        compile_message
    }).then(record => {
        const client_files = fs.readdirSync(`${uploadRootDir}/codes/${record.code}/input`);
        if(client_files.includes('model') && compile_status === 'Success'){
            //copy model to output
            fs.copyFileSync(`${uploadRootDir}/codes/${record.code}/input/model`, `${uploadRootDir}/codes/${record.code}/output/model`);
        }
        axios.post(`${backendUrl}/codes/compile-code/`, {
            code_id: _id,
            status: compile_status,
            message: compile_message,
            key_secret: process.env.KEY_SECRET
        }).then(result => {
            res.status(result.status).send('OK');
        }).catch(err => {
            res.status(500).send(err);
        });
    }).catch(err => {
        res.status(500).send(err);
    })
});

app.post('/friendly-match', async(req, res) => {
    if(!req.body.first_team_code_id) {
        return res.status(400).send('First team is required.');
    }
    if(!req.body.second_team_code_id) {
        return res.status(400).send('Second team is required.');
    }
    if(!req.body.match_result_id) {
        return res.status(400).send('Match result is required.');
    }
    const firstTeamRecord = await Code.findById(req.body.first_team_code_id);
    const secondTeamRecord = await Code.findById(req.body.second_team_code_id);
    if(!firstTeamRecord || !secondTeamRecord) {
        return res.status(400).send('Invalid team id.');
    }
    if(firstTeamRecord.compile_status !== 'Success' || secondTeamRecord.compile_status !== 'Success') {
        return res.status(400).send('One of the teams is not compiled.');
    }
    const match = new Match({
        firstTeam: firstTeamRecord._id,
        secondTeam: secondTeamRecord._id,
        isFriendly: true,
        game_id: req.body.match_result_id
    });
    await match.save();
    runMatch(match._id.toString(), firstTeamRecord.team, firstTeamRecord.code, secondTeamRecord.team, secondTeamRecord.code);
    res.end('OK');
});

app.post('/match-result', async(req, res) => {
    if(!req.body.match_id) {
        return res.status(400).send('match_id is required.');
    }
    if(req.body.winner === undefined) {
        return res.status(400).send('winner is required.');
    }
    const matchRecord = await Match.findById(req.body.match_id);
    matchRecord.status = 'finished';
    matchRecord.winner = req.body.winner;
    await matchRecord.save();
    const gameLog = fs.readFileSync(`${uploadRootDir}/games/${matchRecord._id}/game.json`);
    const serverLog = fs.readFileSync(`${uploadRootDir}/games/${matchRecord._id}/server.log`);

    if(matchRecord.isFriendly) {
        axios.post(`${backendUrl}/match/match-result-friendly/`, {
            code_id: matchRecord.winner,
            match_result_id: matchRecord.game_id,
            server_hash: Buffer.from(serverLog.toString()).toString('base64'),
            game_hash: Buffer.from(gameLog.toString()).toString('base64'),
            key_secret: process.env.KEY_SECRET
        }).then(result => {
            return res.status(200).send('OK');
        }).catch(err => {
            return res.status(500).send(err);
        });
    }
    //TODO: else
});

mongoose.connect(connectionString, {
    useNewUrlParser: true,
    useUnifiedTopology: true
})
    .then(() => {
        console.log(`Connected to MongoDB\nDatabase name is ${db_name}`);
        app.listen(port, () => {
            console.log(`Server is running on port ${port}`);
        });
    })
    .catch((err) => {
        console.log('Error connecting to MongoDB: ' + err);
    });
