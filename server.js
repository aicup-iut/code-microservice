const express = require('express');
const fileUpload = require('express-fileupload');

const app = express();
const port = process.env.PORT || 3000;

app.get('/', (_, res) => {
    res.end('Hello World!');
});

app.post('/submit', fileUpload({
    limits: { fileSize: 20 * 1024 * 1024 }
}), (req, res) => {
    if (!req.files || Object.keys(req.files).length === 0) {
        return res.status(400).send('No files were uploaded.');
    }
    const codeFile = req.files.codeFile;
    const fileExtension = codeFile.name.split('.').pop();
    if(!(fileExtension === 'cpp' || fileExtension === 'py' || fileExtension === 'java')) {
        return res.status(400).send('Invalid file extension.');
    }
    const uniqueId = new Date().getTime().toString() + '-' + Math.floor(Math.random() * 1000).toString();
    const uploadPath = `${__dirname}/uploads/${uniqueId + '.' + fileExtension}`;
    codeFile.mv(uploadPath, (err) => {
        if (err) {
            return res.status(500).send(err);
        }
        res.send('File uploaded!'); //TODO: return _id
    });
});

app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});
