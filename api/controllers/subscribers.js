const needle = require('needle'),
    agent = require('secure-random-user-agent'),
    translate = require('transliteration'),
    fs = require('fs'),
    ytdl = require('ytdl-core');

const subModel = require('../models/subscribers'),
      statsModel = require('../models/stats'),
      token = require('../../modules/token'),
      keys = require('../../modules/keys-api'),
      ndlReq = require('../../modules/needleSend');


needle.defaults({
    user_agent: agent(),
    follow_set_referer      : true,
    follow_if_same_host     : true,
    follow_if_same_protocol : true,
    follow_max: 3
});

function controller(req,res) {
    statsModel.successCronVideo(req);
    res.status(200).json({
        message: 'Ok'
    });
    subModel.listSubscribers(req);

}

function sendLastVideo(req,paths){

        if (typeof (paths)!=='string'){
            let i = -1;
            const int = setInterval(function () {
                i++;
                if (i > paths.length-1) {
                    clearInterval(int)
                }else {
                    console.log(i);
                    let params = {
                        method:'GET',
                        url:'https://www.youtube.com/feeds/videos.xml?channel_id='+ paths[i],
                    };
                    let refresh =  function (){
                        sendLastVideo (req,paths = [paths])
                    };

                    ndlReq.needleReq(params,(answer)=>{
                        if (answer === undefined){
                            setTimeout(refresh, 300000);
                        } else if (answer.statusCode === 200){
                            if (answer.body.children['7'] !== undefined){
                                if (answer.body.children['7'].children['8'].children['4'].children['1'].attributes.views !== '0'){
                                    let videoLast =  answer.body.children['7'].children['1'].value,
                                        name = answer.body.children['3'].value,
                                        titleVideo = answer.body.children['7'].children['3'].value,
                                        originallyPublished = answer.body.children['7'].children['6'].value,
                                        thumbnail = 'https://img.youtube.com/vi/'+videoLast+'/maxresdefault.jpg',
                                        description = answer.body.children['7'].children['8'].children['3'].value;

                                    if (description === ''){
                                        description = null;
                                    }
                                    let video = {
                                            'channelTitle': name,
                                            'videoLast': videoLast,
                                            'titleVideo': titleVideo,
                                            'thumbnail': thumbnail,
                                            'originallyPublished':originallyPublished,
                                            'description':description
                                    };

                                    subModel.LatestVideoNow(req,video,paths[i]);
                                }else {
                                    console.log('Это стрим ::: ' + answer.body.children['7'].children['1'].value);
                                }
                            }
                        } else {
                            statsModel.errorYou(req);
                            console.log(answer);
                        }
                    });
                }

            }, 5000);

        }
}

function addChannelShStream(req,database){
    let name = database.namechannel.toLowerCase().replace(/([\.\,\-\@\s\+\|\'\"\?\!\#\$\%\^\&\*\(\)\|])/g,'_');
    name = translate.transliterate(name);
    console.log('NameChannel :::: '+name);
    let data = {
            description: null,
            displayName: database.namechannel,
            name: name,
            support: null
            },
        url = 'https://showstreams.tv/api/v1/video-channels/';

    token.readTokenSh(req,(tokenSh)=>{
        let options = {
            headers: {
                'Authorization': 'Bearer '+ tokenSh ,
                'Content-Type': 'application/json'
            }};
        let tokenArray = {
            marker:'addChannelShStream',
            req:req,
            database:database
        };
        function refresh(){
            addChannelShStream(req,database)
        }

        let params = {
            opts:options,
            method:'POST',
            url: url,
            data: data
        };

        ndlReq.needleReq(params,(answer)=>{
            if (answer === undefined){
                setTimeout(refresh, 300000);
            }else {
                if (answer.statusCode === 200) {
                    let idChannel = answer.body.videoChannel.id;
                    subModel.createSubscribersIDSh(req,idChannel,database)
                } else if (answer.statusCode === 401){
                    token.getToken(req,tokenArray);
                    console.log(answer.body);
                    console.log('::: Ошибка авторизации :::');
                }else {
                    console.log(data);
                    console.log(answer.body);
                    console.log(answer.statusCode);
                    console.log('::: Ошибка при создании канала :::');
                }
            }
        });
    });
}


function uploadLastVideo (videoParams,req){

        let url = 'https://www.youtube.com/watch?v=' + videoParams.video;

        let file = fs.createWriteStream('video/'+ videoParams.video +'.mp4');

        let file_thumb = fs.createWriteStream('images/'+ videoParams.video +'.jpg');

        ytdl(url,{
            quality: 'highest',
            filter: (format) => format.container === 'mp4',
        }).on('error', (error) => {
            console.log('::: Ошибка при скачивании , видео будет загруженно через ссылку '+ videoParams.video +' :::');

            let video_file = 'video/'+ videoParams.video +'.mp4';
            let thumb_file = 'images/'+ videoParams.video +'.jpg';

            fs.unlink(video_file, function(err){
                if (err) {
                    console.log('::: Ошибка при удаление видео с ошибкой скачивания :::');
                }
            });
            fs.unlink(thumb_file, function(err){
                if (err) {
                    console.log('::: Ошибка при удаление превью c ошибкой скачивания :::');
                }
            });

            downloadFileFlink (req,videoParams);

        }).pipe(file).on('finish',function () {
            uploadFile(videoParams,req);
        });


        needle.get(videoParams.thumbnail).pipe(file_thumb);

}


function uploadFile(video,req){
    token.readTokenSh(req,(tokenSh)=>{
        //Данные для загруки видео
        let filePath = 'video/'+video.video+'.mp4',
            dataUpload = {
                name: 'video',
                privacy: 3,
                nsfw: false,
                commentsEnabled: true,
                downloadEnabled: true,
                waitTranscoding: true,
                channelId: 1,
                videofile: {file: filePath , content_type: 'video/mp4'}
            };
        let tokenArray = {
            marker:'uploadFile',
            video:video,
            req:req
        };

        //Получение сервера для загрузки видео
        serverSelection(req,tokenArray,filePath.length,tokenSh,video,(serverClBc)=>{
            let params = {
                opts:{
                    multipart: true,
                    headers: {
                        'Authorization': 'Bearer '+ tokenSh,
                        'Content-Type': 'application/json',
                    }
                },
                method:'POST',
                url: serverClBc+'/api/v1/videos/upload',
                data: dataUpload
            };

            let filePath_thumb = 'images/' + video.video + '.jpg';

            ndlReq.needleReq(params,(answer) =>{
                if (answer === undefined){
                    console.log('::: Сервер не отвечает :::');
                    statsModel.errorsVideo(req,video);
                }else {
                    if (answer.statusCode === 200){
                        console.log('::: Видео загружается на сервер '+ serverClBc +' :::');
                        //Данные для заполнения загруженного видео
                        let paramsVideo= {
                            token: tokenArray,
                            server:serverClBc,
                            thumb:filePath_thumb,
                            tokenSh:tokenSh,
                            url:answer.body.video.id,
                            filePath:filePath
                        };

                        changingVideos(req,paramsVideo,video);

                    } else if (answer.statusCode === 403){
                        console.log(answer.statusCode);
                        console.log('::: Ошибка при изменение видео :::');
                        statsModel.errorsVideo(req,video);
                    }
                    else if(answer.statusCode === 401){
                        token.getToken(req,tokenArray);
                        console.log(answer.body);
                        console.log('::: Ошибка авторизации :::');
                    } else {
                        console.log(answer);
                        console.log(answer.statusCode );
                        console.log('::: Ошибка при загрузке видео :::');
                        statsModel.errorsVideo(req,video);
                    }
                }
            });
        });
    });
}

function serverSelection(req,tokenArray,filePath,tokenSh,video,serverClBc){
    let params ={
        opts:{
            multipart: true,
            headers: {
                'Authorization': 'Bearer '+ tokenSh,
                'Content-Type': 'application/json',
            }
        },
        method:'GET',
        url: 'https://showstreams.tv/api/v1/server/server_for_upload?videoLength='+filePath,
        data: ''
    };
    function refresh(){
        serverSelection(req,tokenArray,filePath,tokenSh,video,serverClBc);
    }

    ndlReq.needleReq(params,(answer) =>{
        if (answer === undefined){
            statsModel.errorsVideo(req,video);
            statsModel.showstreamsEr(req);
        } else if (answer.statusCode === 200){
            serverOperationCheck(tokenSh,answer.body.upload_host,(cl)=>{
                if (cl === true){
                    serverClBc(answer.body.upload_host);
                }else {
                    console.log('::: Отправлен повторный запрос на новый сервер для загрузки видео 30000 мс :::');
                    setTimeout(refresh, 30000);
                }
            });
        }else if (answer.statusCode === 401){
            token.getToken(req,tokenArray);
            console.log(answer.body);
            console.log('::: Ошибка авторизации :::');
        }else {
            console.log(answer);
            statsModel.errorsVideo(req,video);
            statsModel.showstreamsEr(req);
        }
    });
}

function serverOperationCheck(tokenSh,upload_host,cl){
    let params ={
        opts:{
            multipart: true,
            headers: {
                'Authorization': 'Bearer '+ tokenSh,
                'Content-Type': 'application/json',
            }
        },
        method:'GET',
        url: upload_host,
        data: ''
    };
    ndlReq.needleReq(params,(answer) =>{
        if (answer === undefined){
            cl(false);
        } else if (answer.statusCode === 200){
            cl(true);
        }else {
            cl(false);
            console.log('::: Проблема с сервером ' + upload_host +":::");
            console.log(answer);
        }
    });
}

function changingVideos(req,paramsVideo,video){
    let dataPut = {
        name: video.title,
        // category: 1, //музыка
        licence: null,
        language: null,
        support: null,
        description: video.description,
        channelId: video.id,
        privacy: 1,
        // tags:['Nightblue Music','Nightblue3','Trap Music'],
        nsfw: false,
        waitTranscoding: false,
        commentsEnabled: true,
        downloadEnabled: true,
        thumbnailfile: {file: paramsVideo.thumb , content_type: 'image/jpeg'},
        previewfile: {file: paramsVideo.thumb , content_type: 'image/jpeg'},
        scheduleUpdate: null,
        originallyPublishedAt: video.original,
    };
    let params2 = {
        opts:{
            multipart: true,
            headers: {
                'Authorization': 'Bearer ' + paramsVideo.tokenSh,
                'Content-Type': 'application/json'
            }
        },
        method:'PUT',
        url: paramsVideo.server+'/api/v1/videos/'+ paramsVideo.url,
        data:dataPut
    };

    ndlReq.needleReq(params2,(answer) =>{
        if (answer.statusCode === 204){
            console.log("успех");
            fs.unlink(paramsVideo.filePath, function(err){
                if (err) {
                    console.log(err);
                    console.log('::: Ошибка при удаление видео :::');
                } else {
                    console.log("Файл удалён");
                    statsModel.successVideo(req);
                }
            });
            fs.unlink(paramsVideo.thumb, function(err){
                if (err) {
                    console.log(err);
                    console.log('::: Ошибка при удаление превью :::');
                } else {
                    console.log("Превью удалён");
                }
            });
        }else if(answer.statusCode === 401){
            token.getToken(req,paramsVideo.token);
            console.log(answer.body);
            console.log('::: Ошибка авторизации :::');
            // Status Code ::400
        }else if (answer.statusCode === 403){
            console.log(answer.statusCode);
            console.log('::: Ошибка при изменение видео :::');
            statsModel.errorsVideo(req,video);
        }  else {
            console.log(answer);
            console.log('::: Ошибка при изменение видео :::');
            statsModel.errorsVideo(req,video);
        }
    });
}

function downloadFileFlink (req,video){
    let data = {
            channelId: video.id,
            targetUrl: 'https://www.youtube.com/watch?v='+ video.video,
            privacy: 1
        };


    token.readTokenSh(req,(tokenSh)=> {
        let params = {
            opts: {
                multipart: true,
                headers: {
                    'Authorization': 'Bearer ' + tokenSh,
                    'Content-Type': 'application/json',
                }
            },
            method: 'POST',
            url: 'https://showstreams.tv/api/v1/videos/imports',
            data: data
        };
        let tokenArray = {
                marker:'downloadFileFlink',
                video:video,
                req:req,
        };
        ndlReq.needleReq(params, (answer) => {
            if (answer === undefined) {
                console.log('Ошибка при отправке видео: response  undefined ');
                console.log(answer);
                console.log(data);
                statsModel.errorsVideo(req,video);
            } else {
                if (answer.statusCode === 200) {
                    console.log('успех');
                } else if (answer.statusCode === 401) {
                    token.getToken(req, tokenArray);
                    console.log(answer.body);
                    console.log('Ошибка авторизации');
                } else {
                    console.log(data);
                    console.log(answer.body);
                    console.log('Status Code ::' + answer.statusCode);
                    console.log('Ошибка при отправке видео');
                    statsModel.errorsVideo(req,video);
                }
            }
        });
    });
}

exports.controller = controller;
exports.sendLastVideo = sendLastVideo;
exports.addChannelShStream = addChannelShStream;
exports.uploadLastVideo = uploadLastVideo;
exports.downloadFileFlink = downloadFileFlink;
exports.uploadFile = uploadFile;
