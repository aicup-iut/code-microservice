const express = require('express');
const fileUpload = require('express-fileupload');
const mongoose = require('mongoose');
const axios = require('axios');
const fs = require('fs');
const fse = require('fs-extra');
const logger = require('morgan');
const schedule = require('node-schedule');

const Code = require("./models/Code");
const Match = require("./models/Match");
const {
    compileCode,
    runMatch,
    saveMatchResult
} = require("./utils");

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
}), async(req, res) => {
    return res.status(400).send('The time for this has ended');
    if (!req.files || Object.keys(req.files).length === 0) {
        return res.status(400).send('No files were uploaded.');
    }
    if(!req.body.teamName) {
        return res.status(400).send('Team name is required.');
    }
    const codeFile = req.files.file;
    const modelFile = req.files.model;
    const fileExtension = codeFile.name.split('.').pop();
    if(fileExtension !== 'py' && fileExtension !== 'java' && fileExtension !== 'cpp') {
        return res.status(400).send('Invalid file extension.');
    }
    const uniqueId = new Date().getTime().toString() + '-' + Math.floor(Math.random() * 1000).toString();
    const newFileName = 'main.' + fileExtension;
    fs.mkdirSync(`${uploadRootDir}/codes/${uniqueId}`);
    const workingDir = `${uploadRootDir}/codes/${uniqueId}/input/`;
    fs.mkdirSync(workingDir);
    fs.mkdirSync(`${uploadRootDir}/codes/${uniqueId}/output`);
    await codeFile.mv(workingDir + newFileName);
    if(modelFile) await modelFile.mv(workingDir + 'model');
    const code = new Code({
        team: req.body.teamName,
        code: uniqueId,
        lang: fileExtension
    });
    const _doc = await code.save()
    const _id = _doc._id.toString();
    compileCode(_id, uniqueId);
    res.end(_id);
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
    const compile_message = req.body.compile_message.toString().slice(0, 4096);
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
    return res.status(400).send('The time for this has ended');
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
    fs.mkdirSync(`${uploadRootDir}/logs/${match._id}`);
    runMatch(match._id.toString(), firstTeamRecord.team, firstTeamRecord.code, firstTeamRecord.lang ,secondTeamRecord.team, secondTeamRecord.code, secondTeamRecord.lang);
    res.end('OK');
});

app.post('/match-result', async(req, res) => {
    if(!req.body.match_id) {
        return res.status(400).send('match_id is required.');
    }
    if(req.body.status === undefined) {
        return res.status(400).send('status is required.');
    }
    if(req.body.status == -1) {
        await axios.post(process.env.WEBHOOKURL, {
            content: `Match ${req.body.match_id} returned -1! Panic Mode: ON`
        });
        return res.status(400).send(`Match ${req.body.match_id} returned -1!`);
    }
    const matchRecord = await Match.findById(req.body.match_id);
    if(!matchRecord.isFriendly) {
        matchRecord.status = 'failed';
        await matchRecord.save();
        const currentDate = new Date();
        const futureDate = new Date(currentDate.getTime() + (1 * 60 * 1000));
        schedule.scheduleJob(futureDate, async function(matchRecord){
            if(!fs.readdirSync(`${uploadRootDir}/logs/${matchRecord._id}`).includes('game.json'))
                await axios.post(process.env.WEBHOOKURL, {
                    content: "Failed after 3 min " + JSON.stringify(matchRecord) + "!PANIC!"
                });
            else await saveMatchResult(matchRecord)
        }.bind(this, matchRecord));
        return res.end('OK');
    }
    let polling_count = 0;
    while(!fs.readdirSync(`${uploadRootDir}/logs/${matchRecord._id}`).includes('game.json') && polling_count < 10) {
        polling_count++;
        await new Promise(r => setTimeout(r, 250));
    }
    if(polling_count >= 10) {
        matchRecord.status = 'failed';
        await matchRecord.save();
        const currentDate = new Date();
        const futureDate = new Date(currentDate.getTime() + (5 * 60 * 1000));
        schedule.scheduleJob(futureDate, async function(matchRecord) {
            if(!fs.readdirSync(`${uploadRootDir}/logs/${matchRecord._id}`).includes('game.json'))
                await axios.post(process.env.WEBHOOKURL, {
                    content: "Failed after 5 min " + JSON.stringify(matchRecord) + "!PANIC!"
                });
            else await saveMatchResult(matchRecord)
        }.bind(null, matchRecord));
        return res.status(200).send(`Match ${req.body.match_id} failed, but scheduled for 5 min`);
    } else {
        await saveMatchResult(matchRecord);
        res.end('OK');
    }
});

app.post('/match', async(req, res) => {
     if(!req.body.team1) {
        return res.status(400).send('First team is required.');
    }
    if(!req.body.team2) {
        return res.status(400).send('Second team is required.');
    }
    const firstTeamRecord = await Code.findById(req.body.team1);
    const secondTeamRecord = await Code.findById(req.body.team2);
    if(!firstTeamRecord || !secondTeamRecord) {
        return res.status(400).send('Invalid team id.');
    }
    if(firstTeamRecord.compile_status !== 'Success' || secondTeamRecord.compile_status !== 'Success') {
        return res.status(400).send('One of the teams is not compiled.');
    }
    const match = new Match({
        firstTeam: firstTeamRecord._id,
        secondTeam: secondTeamRecord._id,
        isFriendly: false
    });
    await match.save();
    fs.mkdirSync(`${uploadRootDir}/logs/${match._id}`);
    runMatch(match._id.toString(), firstTeamRecord.team, firstTeamRecord.code, firstTeamRecord.lang ,secondTeamRecord.team, secondTeamRecord.code, secondTeamRecord.lang);
    res.end(match._id.toString());
});

app.get('/result/:id', async(req, res) => {
    const matchRecord = await Match.findById(req.params.id);
    if(!matchRecord) {
        return res.status(400).send('Invalid match id.');
    }
    res.send(matchRecord);
});

app.post('/delete-code', async(req, res) => {
    return res.status(400).send('The time for this has ended');
    if(!req.body["code-id"]){
        return res.status(400).send('code-id is required.');
    }
    const _doc = await Code.findById(req.body["code-id"]);
    fs.rmSync(`${uploadRootDir}/codes/${_doc.code}/output`, { recursive: true, force: true });
    res.end('OK');
});

app.post('/teamcpy', async(req, res) => {
    return res.status(400).send('The time for this has ended');
    if(!req.body.team_id) {
        return res.status(400).send('team_id is required.');
    }
    if(!req.body.human_id) {
        return res.status(400).send('human_id is required.');
    }
    const teamRecord = await Code.findById(req.body.team_id);
    if(!teamRecord) {
        return res.status(400).send('Invalid team id.');
    }
    const codeFolder = `${uploadRootDir}/codes/${teamRecord.code}`;
    fs.mkdirSync(`${uploadRootDir}/codes/${req.body.human_id}`);
    fse.copySync(codeFolder, `${uploadRootDir}/codes/${req.body.human_id}`);
    res.end('OK');
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
