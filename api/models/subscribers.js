const subModel = require('../controllers/subscribers'),
    ytdl = require('ytdl-core');

function listSubscribers(req) {
    req.models.subscribers.all(function (err, results) {
        let paths = [];
        for (let i = 0; i < results.length;i++){
            paths.push(results[i].path);
        }
        subModel.sendLastVideo(req,paths);
    });

}

function LatestVideoNow(req,video,path){
    req.models.subscribers.find({path:path},function (err, results) {
        if (results['0'].lastvideo !== video.videoLast && video.originallyPublished !== results['0'].originallypublished ){
            console.log(results['0'].lastvideo + ':: !== ::' + video.videoLast);
            if (results[0].namechannel !== video.channelTitle){
                results[0].namechannel = video.channelTitle;
            }
            results[0].lastvideo = video.videoLast;
            results[0].titlevideo = video.titleVideo;
            results[0].description = video.description;
            results[0].thumbnail = video.thumbnail;
            results[0].originallypublished = video.originallyPublished;
            results[0].save(function (err) {
                if (err){
                    console.log(err);
                }
                ytdl.getInfo('https://www.youtube.com/watch?v='+ results['0'].lastvideo, (err, info) => {
                    if (err){
                        console.log(err);
                    }

                    let thisStream = info.player_response.videoDetails.isLiveContent;

                    if (thisStream === false){
                        if (results[0].show_id === null){
                            subModel.addChannelShStream(req,results[0]);
                        }else {
                            findByIdShowId(req,results[0].show_id)
                        }
                    }else {
                        console.log('::: Данный контент является стримом ' + results['0'].lastvideo)
                    }
                });


            });
        }


    });
}

function createSubscribersIDSh(req,id,database){
    req.models.subscribers.find({path:database.path},function (err, results) {
        results[0].show_id = id;
        let videoParams = {
            id:id,
            video:database.lastvideo,
            title:database.titlevideo,
            original:database.originallypublished,
            description:database.description,
            thumbnail:database.thumbnail
        };
        results[0].save(function (err) {
            subModel.uploadLastVideo(videoParams,req);
        });
    });
}

function findByIdShowId(req,id){
    req.models.subscribers.find({show_id:id}, function (err, result) {
        console.log('Поиск видео по id ::: '+result[0].lastvideo);
        let videoParams = {
            id:result[0].show_id,
            video:result[0].lastvideo,
            title:result[0].titlevideo,
            original:result[0].originallypublished,
            description:result[0].description,
            thumbnail:result[0].thumbnail
        };
        subModel.uploadLastVideo(videoParams,req);
    })
}
