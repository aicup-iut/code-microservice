const express = require('express');
const fileUpload = require('express-fileupload');
const mongoose = require('mongoose');
const Code = require("./models/Code");
const { compileCode } = require("./utils");

const app = express();
const port = process.env.PORT || 3000;
const db_user_name = process.env.MONGO_INITDB_ROOT_USERNAME || 'root';
const db_password = process.env.MONGO_INITDB_ROOT_PASSWORD || 'root';
const db_name = process.env.DB_NAME || 'aicup';
const db_host = process.env.DB_HOST || 'localhost';
const db_port = process.env.DB_PORT || 4040;
const connectionString = `mongodb://${db_user_name}:${db_password}@${db_host}:${db_port}/${db_name}?authSource=admin`;

//TODO: Add logger
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get('/', (_, res) => {
    res.end('Hello World!');
});

app.post('/submit', fileUpload({
    limits: { fileSize: 20 * 1024 * 1024 }
}), (req, res) => {
    if (!req.files || Object.keys(req.files).length === 0) {
        return res.status(400).send('No files were uploaded.');
    }
    if(!req.body.teamName) {
        return res.status(400).send('Team name is required.');
    }
    const codeFile = req.files.codeFile;
    const fileExtension = codeFile.name.split('.').pop();
    if(!(fileExtension === 'cpp' || fileExtension === 'py' || fileExtension === 'java')) {
        return res.status(400).send('Invalid file extension.');
    }
    const uniqueId = new Date().getTime().toString() + '-' + Math.floor(Math.random() * 1000).toString();
    const newFileName = uniqueId + '.' + fileExtension;
    const uploadPath = `${__dirname}/uploads/${newFileName}`;
    codeFile.mv(uploadPath, (err) => {
        if (err) {
            return res.status(500).send(err);
        }
        const code = new Code({
            team: req.body.teamName,
            code: newFileName
        });
        code.save().then(_doc => {
            const _id = _doc._id.toString();
            compileCode(_id, newFileName);
            res.end(_id);
        }).catch((err) => {
            res.status(500).send(err);
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
    }).then(_ => {
        //TODO: send result to backend
        res.end('OK');
    }).catch(err => {
        res.status(500).send(err);
    })
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
