const express = require('express');
const osu = require('node-os-utils');

const app = express();
const cpu = osu.cpu;
const mem = osu.mem;
const drive = osu.drive;

app.get('/cpu', async(_, res) => {
    res.end(JSON.stringify(await cpu.free()));
});

app.get('/mem', async(_, res) => {
    res.end(JSON.stringify(await mem.free()));
});

app.get('/drive', async(_, res) => {
    res.end(JSON.stringify(await drive.info()));
});

app.get('/ok', async(_, res) => {
    const fcpu = JSON.stringify(await cpu.free());
    let fmem = JSON.stringify(await mem.free());
    fmem = JSON.parse(fmem);
    fmem = fmem["freeMemMb"] / fmem["totalMemMb"] * 100;
    const ans = (fcpu > 15.0 && fmem > 15.0) ? "OK" : "NOT OK";
    console.log(`CPU: ${fcpu} && MEM: ${fmem} && ANS: ${ans}`);
    res.end(ans);
});

app.listen(5000, () => {
    console.log("Server running on port 5000");
});
