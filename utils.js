const schedule = require('node-schedule');

const resourceChecker = mode => {
    //TODO
    return true;
};

const compileCode = (_id, code) => {
    const haveResource = resourceChecker('COMPILE');
    if (haveResource) {
        console.log('Compiling code...');
        console.log(_id, code); //TODO: API Call
    } else {
        console.log('No Resource for compile...');
        const currentDate = new Date();
        const futureDate = new Date(currentDate.getTime() + (60 * 1000) + Math.random() * 10);
        schedule.scheduleJob(futureDate, () => compileCode(_id, code));
    }
}

const runMatch = (match_id, code1, code2) => {
    const haveResource = resourceChecker('MATCH');
    if (haveResource) {
        console.log('Running match...');
        //TODO: Adding team names
        console.log(match_id, code1, code2); //TODO: API Call
    } else {
        console.log('No Resource for match...');
        const currentDate = new Date();
        const futureDate = new Date(currentDate.getTime() + (120 * 1000) + Math.random() * 10);
        schedule.scheduleJob(futureDate, () => runMatch(_id, code));
    }
}

module.exports = {
    compileCode,
    runMatch
}
