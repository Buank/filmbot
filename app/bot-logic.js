const needle = require('needle'),
     CronJob = require('cron').CronJob;

function actionCronLastVideo() {
    new CronJob('0 */5 * * * *', function() {
        let params = {
            method:'GET',
            url:'http://localhost:2000/channelList',
            data:{type:'download'}
        };
        needle.request(params.method, params.url, params.data, function(error, response) {
            if (response === undefined){
                console.log('response undefined cron');
            }else {
                if (response.statusCode === 200){
                    console.log("cron оправил запрос");
                }else {
                    console.log(error);
                }
            }
        });
    }, null, true, 'America/Los_Angeles');

    new CronJob('0 */33 * * * *', function() {
    let params = {
        method:'GET',
        url:'http://localhost:2000/channelList',
        data:{type:'new'}
    };
    needle.request(params.method, params.url, params.data, function(error, response) {

        if (response === undefined){
            console.log('response undefined cron');
        }else {
            if (response.statusCode === 200){
                console.log("cron оправил запрос");
            }else {
                console.log(error);
            }
        }
    });
    }, null, true, 'America/Los_Angeles');
}

exports.actionCronLastVideo = actionCronLastVideo;



