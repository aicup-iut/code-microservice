const express = require('express');
const osu = require('node-os-utils');

const app = express();
const cpu = osu.cpu;
const mem = osu.mem;

app.use('/cpu', async(_, res) => {
    res.end(JSON.stringify(await cpu.free()));
});

app.use('/mem', async(_, res) => {
    res.end(JSON.stringify(await mem.free()));
});

app.listen(5000, () => {
    console.log("Server running on port 5000");
});
