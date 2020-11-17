const needle = require('needle'),
    env = require("../../app/config/env"),
    films = require('../models/films'),
    fetch = require('node-fetch'),
    url = require('url'),
    Q = require('q'),
    http = require('http'),
    fs = require('fs'),
    exec = require("executive"),
    cheerio = require('cheerio'),
    HttpsProxyAgent = require('https-proxy-agent'),
    token = require('../../modules/token'),
    ndlReq = require('../../modules/needleSend');

let imaps = require('imap-simple');
let options = {
    "agent": new HttpsProxyAgent('http://127.0.0.1:9911/'),
    "headers": {}
};


function controller(req, res) {
    console.log(req.query.type);
    // const body = req.body;
    // films.getLastFilm(req);
    goToLoginPub(req, res, req.query.type);
    res.status(200).json({
        message: 'Ok'
    });
}

async function goToLoginPub(req, res, type) {
    await needle.get(env.kino_pub_url + '/user/login', { "agent": new HttpsProxyAgent('http://127.0.0.1:9911/') }, function (err, resp, body) {
        authToPub(req, resp, type);
    });
}

// Автоматическая авторизация на сайте кинопаба
async function authToPub(req, get_resp, type, formcode = '') {
    console.log(type);
    const regex = /name="_csrf" value="([a-zA-Z0-9_\-=]+)">/;

    let str = await get_resp.body;
    let csrf = regex.exec(str)[1];
    let cookies = get_resp.headers['set-cookie'].toString();
    const data = {
        '_csrf': csrf,
        'login-form[login]': env.kino_pub_login,
        'login-form[password]': env.kino_pub_password,
        'login-form[rememberMe]': "1"
    };

    if (formcode !== '') {
        data['login-form[formcode]'] = formcode;
    }

    let requestOptions = {
        method: 'POST',
        agent: new HttpsProxyAgent('http://127.0.0.1:9911/'),
        headers: {
            "Cookie": cookies.replace(/(path=\/; HttpOnly(,|$))/, ''),
            "Content-Type": "application/x-www-form-urlencoded",
        },
        redirect: 'follow'
    };

    needle.post(env.kino_pub_url + '/user/login', data, requestOptions, function(err, resp) {
        if (resp.statusCode === 200 && formcode === '') {
            getFormcode(req, get_resp, type);
        }
        if (resp.statusCode === 302 && formcode !== '') {

            cookie = resp.headers['set-cookie'].toString();
            options.headers = {
                "Cookie": cookie.replace(/(path=\/; HttpOnly(,|$))/g,''),
                "Content-Type": "application/x-www-form-urlencoded"
            };
            if (type === 'new') {
                getVideoList(req, options);
            } if (type === 'download') {
                films.getLastFilm(req, options)
            }
        }
    });
}

// Таймаут перед получением кода из почты, чтобы письмо успело дойти
function getFormcode(req, get_resp, type, formcode = '') {
    setTimeout(async function () {
        formcode = await goToMail().then((res) => {
            return res;
        });
        if (formcode !== '') {
            authToPub(req, get_resp, type, formcode);
        }
    },2000);
}

// Подключаемся к почте и получаем код из письма с кинопаба
async function goToMail() {
    let regex = /<strong>(\d+)<\/strong>/;
    let config = {
        imap: {
            user: env.imap_user,
            password: env.imap_password,
            host: env.imap_host,
            port: env.imap_port,
            tls: env.imap_tls
        }
    };
    let formcode = await imaps.connect(config).then(function (connection) {
        return connection.openBox('INBOX').then(function () {
            let searchCriteria = ['UNSEEN'];
            let fetchOptions = {
                bodies: ['TEXT'],
                markSeen: true
            };
            return connection.search(searchCriteria, fetchOptions).then(function (results) {
                let subjects = results.map(function (res) {
                    return res.parts.filter(function (part) {
                        return part.which === 'TEXT';
                    })[0].body;
                });
                connection.end();
                return regex.exec(subjects)[1];
            });
        });
    });
    return formcode;
}

// Получаем список всех видео со страницы
function getVideoList(req, options) {
    needle.get(env.kino_pub_url + '/new', options, function(err, resp, body) {
        let $ = cheerio.load(body);
        let links = $("div.item-title > a");
        $(links).each(function(i, link) {
            let regex = /item\/view\/(\d+)\//;
            let url = $(link).attr('href'),
                title = $(link).text(),
                id = regex.exec(url);
            films.checkById(req, {title: title, link: url, id: +id[1]});
        });
    });
}

// Получаем инфу у каждого видоса отдельно - это в кроне вызывать вместе с запросом видоса
async function getVideosInfoAndDownload(req, url, options) {
        needle.get(env.kino_pub_url + url, options, async function (err, resp, body) {
            let $ = await cheerio.load(body),
                title = $("title").text(),
                link = $("a:contains('720p')").attr('href'),
                description_text = $("#plot").text(),
                id = $("input[name='id']").val(),
                thumb = $("img.item-poster-relative").attr('src'),
                rating = $("td:contains('Рейтинг')").siblings('td').text(),
                year = $("td:contains('Год выхода')").siblings('td').text(),
                country = $("td:contains('Страна')").siblings('td').text(),
                genre = $("td:contains('Жанр')").siblings('td').text(),
                director = $("td:contains('Режиссёр')").siblings('td').text(),
                actors =  $("td:contains('В ролях')").siblings('td').text(),
                duration =  $("td:contains('Длительность')").siblings('td').text(),
                age =  $("td:contains('Возраст')").siblings('td').text();
            let regex = /\/\/.*\/(.*).mp4.*/g;
            let filename = regex.exec(link)[1];
            const tableRow = { title, rating, year, country, genre, director, actors, id, description_text, duration, age, link, filename, thumb };
            films.changeStatus(req, id,1);
            downloadWithRedirect(tableRow, req, options);
        });
}

function downloadWithRedirect(videoParams, req) {
    let protocol = url.parse(videoParams.link).protocol.slice(0, -1);
    let deferred = Q.defer();
    let filename = 'video/' + videoParams.filename + '.mp4';
    let thumb_file = 'images/' + videoParams.filename + '.jpg';
    let onError = function (e) {
        fs.unlink(filename);
        deferred.reject(e);
    };
    require(protocol).get(videoParams.thumb, function(response) {
        let fileStream_thumb = fs.createWriteStream(thumb_file);
        fileStream_thumb.on('error', onError);
        fileStream_thumb.on('close', deferred.resolve);
        response.pipe(fileStream_thumb).on('finish', function () {
            require(protocol).get(videoParams.link, function(response) {
                if (response.statusCode >= 200 && response.statusCode < 300) {
                    let fileStream = fs.createWriteStream(filename);
                    fileStream.on('error', onError);
                    fileStream.on('close', deferred.resolve);
                    response.pipe(fileStream).on('finish', function () {
                        console.log('Я все');
                        let video = {
                            id: videoParams.id,
                            name: videoParams.filename,
                            title: videoParams.title,
                            original: '',
                            detail: videoParams
                        };
                        sendFilesSftp(req, video);
                    });
                } else if (response.headers.location) {
                    videoParams.link = response.headers.location;
                    deferred.resolve(downloadWithRedirect(videoParams, req));
                } else {
                    deferred.reject(new Error(response.statusCode + ' ' + response.statusMessage));
                }
            }).on('error', onError);
        });
    });
    return deferred.promise;
}

async function sendFilesSftp(req, videoParams) {
    console.log('Я отсылаю по фтп');

    const size = await getFilesizeInBytes('video/' + videoParams.name + '.mp4');
    const fileName = videoParams.name + '.mp4';

    //----------------------------------SFTP-----------------------------------------

    await exec('sshpass -p "' + env.sftpPas + '" scp -c aes128-ctr -P ' + env.port + ' images/' + videoParams.name + '.jpg ' +
        env.sftpLogin + '@' + env.sftpServer + ':' + env.storagePreviews);

    await exec('sshpass -p "' + env.sftpPas + '" scp -c aes128-ctr -P ' + env.port + ' images/' + videoParams.name + '.jpg ' +
        env.sftpLogin + '@' + env.sftpServer + ':' + env.storageThumbnails);

    await exec('sshpass -p "' + env.sftpPas + '" scp -c aes128-ctr -P '+ env.port +' video/' + fileName + ' ' + env.sftpLogin + '@' +
        env.sftpServer + ':' + env.storageVideos)

        .then(() => {
            //----------------------------------SFTP Logic------------------------------------
                removeVideo(videoParams.name);
                console.log('Видео успешно отправлено :: ' + videoParams.name);
                addVideoToSh(req, videoParams, size)
        })
        .catch(() => {
            // telegram.mesEr('' +
            //     'Разрыв sftp соединения \n\n ' +
            //     'Видео:' + videoParams.name + ' не добавилось на сервер');
            // errorVideo(videoParams);
            removeVideo(videoParams.name);

        });
}

function addVideoToSh(req, videoParams, size) {
    console.log('Шлю данные');
    let regex = /(\n)/;
    let year = videoParams.detail.year.replace(regex, ''),
        director = videoParams.detail.director.replace(regex, ''),
        rating = videoParams.detail.rating.replace(regex, ''),
        country= videoParams.detail.country.replace(regex, ''),
        duration = videoParams.detail.duration.replace(regex, ''),
        actors = videoParams.detail.actors.replace(regex, ''),
        genre = videoParams.detail.genre.replace(regex, '');
    let viewCount = (videoParams.detail.view_count === null || videoParams.detail.view_count === undefined)? 0 :videoParams.detail.view_count,
        data = {
            channelId: 2804,
            category: 2,
            fileName:videoParams.name,
            name: videoParams.title,
            description: videoParams.detail.description_text + '' +
                '\n Рейтинг: ' + rating +
                '\n Год выхода: ' + year +
                '\n Страна: ' + country +
                '\n Жанр: ' + genre +
                '\n Режиссёр: ' + director +
                '\n В ролях: ' + actors +
                '\n Продолжительность: ' + duration,
            privacy: 1,
            nsfw: false,
            payment: false,
            tags: [year, country, director],
            freeTime: 10,
            currency: 1,
            price: 1,
            waitTranscoding: false,
            commentsEnabled: true,
            downloadEnabled: true,
            originallyPublishedAt: null,
            // duration: duration,
            size:size,
            pass:env.securityKey,
            viewCount:viewCount,
        };

    let params = {
        method: 'POST',
        url: env.apiAddServer,
        data: data
    };

    ndlReq.needleReq(params, (answer) => {
        if (answer === undefined) {
            // telegram.mesEr('' +
            //     'Сервер выдал ошибку :: undefined \n' +
            //     'Showstreams.tv - времннено не отвечает или слишком долгое ожидание ответа от сервера\n' +
            //     'Видео:' + videoParams.name+ ' - не прошло загрузку из за ошибки \n' +
            //     'Название видео:' + videoParams.title);
            // Возможно это ошибка так как зациклить может
            // но если сервер пересобирают то 100% будет undefined
            // TODO если циклить не будет удалить комент если будет удалить setTimeout
            setTimeout(()=>{addVideoToSh(videoParams,size)},300000);

            films.changeStatus(req, videoParams.id, 3);

            console.log('Ошибка при отправке видео: response  undefined ');
        } else if (answer.statusCode === 200) {
            console.log('success import ');
        } else if (answer.statusCode === 401) {
            // telegram.mesEr('Status Code: ' + answer.statusCode + '\n' +
            //     'Ошибка авторизации\nКАК ??');
        } else if (answer.statusCode === 502) {
            setTimeout(()=>{addVideoToSh(videoParams,size)},300000);
            // telegram.mesEr('Status Code: ' + answer.statusCode + '\n' +
            //     'Сервер: showstreams.tv\n' +
            //     'Видео:'+videoParams.id_video+'\n'+
            //     'Название видео:' + videoParams.tittle_video+'\n' +
            //     'Видео будет повторно загруженно через 5 мин');
        } else if (answer.statusCode === 524) {
            setTimeout(()=>{addVideoToSh(videoParams,size)},300000);
            // telegram.mesEr('Status Code: ' + answer.statusCode + '\n' +
            //     'Сервер: showstreams.tv\n' +
            //     'Видео:'+videoParams.id_video+'\n'+
            //     'Название видео:' + videoParams.tittle_video+'\n' +
            //     'Время ожидания ответа от showstreams.tv истекло\n' +
            //     'Видео будет повторно загруженно через 5 мин');
        } else if (answer.statusCode === 406) {
            films.changeStatus(req, videoParams.id, 3);
            // telegram.mesEr('Status Code: ' + answer.statusCode + '\n' +
            //     'Сервер: showstreams.tv\n' +
            //     'Видео:'+videoParams.id_video+'\n'+
            //     'Название видео:' + videoParams.tittle_video+'\n' +
            //     'Произошел разрыв соединения ftp и файл загрузился с ошибкой на sh\n' +
            //     'Файл удален с sh и добавлен в очередь для повторной отправки');
        } else {
            // telegram.mesEr('Status Code: ' + answer.statusCode + '\n' +
            //     'Сервер: showstreams.tv\n' +
            //     'Видео:'+videoParams.name+'\n'+
            //     'Название видео:' + videoParams.title);

        }
    });
}

function removeVideo(path) {
    let video_file = 'video/' + path + '.mp4';
    let thumb_file = 'images/' + path + '.jpg';

    fs.unlink(video_file, function (err) {
        if (err) {
            console.log('::: Ошибка при удаление видео :::' + video_file);
        }
    });
    fs.unlink(thumb_file, function (err) {
        if (err) {
            console.log('::: Ошибка при удаление превью :::' + thumb_file);
        }
    });
}

async function getFilesizeInBytes(filename) {
    let stats = fs.statSync(filename);
    return stats["size"]
}

function uploadFile(video, req) {
    token.readTokenSh(req,(tokenSh) => {
        //Данные для загруки видео
        let regex = /(\n)/;
        let year = video.videoParams.year.replace(regex, ''),
            director = video.videoParams.director.replace(regex, ''),
            rating = video.videoParams.rating.replace(regex, ''),
            country= video.videoParams.country.replace(regex, ''),
            duration = video.videoParams.duration.replace(regex, ''),
            actors = video.videoParams.actors.replace(regex, ''),
            genre = video.videoParams.genre.replace(regex, '');
        let filePath = 'video/' + video.name + '.mp4',
            dataUpload = {
                name: 'video',
                privacy: 2,
                nsfw: false,
                commentsEnabled: true,
                downloadEnabled: true,
                payment: false,
                freeTime: 10,
                currency: 1,
                description: video.videoParams.description_text + '' +
                    '\n Рейтинг: ' + rating +
                    '\n Год выхода: ' + year +
                    '\n Страна: ' + country +
                    '\n Жанр: ' + genre +
                    '\n Режиссёр: ' + director +
                    '\n В ролях: ' + actors +
                    '\n Продолжительность: ' + duration,
                price: 1,
                tags: [year, country, director],
                waitTranscoding: true,
                channelId: 2804,
                videofile: {file: filePath , content_type: 'video/mp4'}
            };
        let tokenArray = {
            marker: 'uploadFile',
            video: video,
            req: req
        };

        //Получение сервера для загрузки видео
        serverSelection(req, tokenArray, filePath.length, tokenSh, video, (serverClBc) => {
            let params = {
                opts: {
                    multipart: true,
                    headers: {
                        'Authorization': 'Bearer ' + tokenSh,
                        'Content-Type': 'application/json',
                    }
                },
                method: 'POST',
                url: serverClBc + '/api/v1/videos/upload',
                data: dataUpload
            };

            let filePath_thumb = 'images/' + video.name + '.jpg';

            ndlReq.needleReq(params, (answer) => {
                if (answer === undefined) {
                    console.log('::: Сервер не отвечает :::');
                } else {
                    if (answer.statusCode === 200) {
                        console.log('::: Видео загружается на сервер ' + serverClBc + ' :::');
                        //Данные для заполнения загруженного видео
                        let paramsVideo= {
                            token: tokenArray,
                            server: serverClBc,
                            thumb: filePath_thumb,
                            tokenSh: tokenSh,
                            url: answer.body.video.id,
                            filePath: filePath
                        };

                        changingVideos(req, paramsVideo, video);

                    } else if (answer.statusCode === 403) {
                        console.log(answer.statusCode);
                        console.log('::: Ошибка при изменение видео :::');
                    } else if (answer.statusCode === 401) {
                        token.getToken(req,tokenArray);
                        console.log('::: Ошибка авторизации :::');
                    } else {
                        console.log(answer.statusCode );
                        console.log('::: Ошибка при загрузке видео :::');
                    }
                }
            });
        });
    });
}

function changingVideos(req, paramsVideo, video){
    let dataPut = {
        name: video.title,
        category: 2,
        licence: null,
        language: null,
        support: null,
        description: video.description,
        channelId: 2804,
        privacy: 1,
        tags: null,
        nsfw: false,
        waitTranscoding: true,
        commentsEnabled: true,
        downloadEnabled: true,
        payment: false,
        freeTime: 10,
        currency: 1,
        price: 1,
        thumbnailfile: {file: paramsVideo.thumb , content_type: 'image/jpeg'},
        previewfile: {file: paramsVideo.thumb , content_type: 'image/jpeg'},
        scheduleUpdate: null,
        originallyPublishedAt: null
    };
    let params2 = {
        opts: {
            multipart: true,
            headers: {
                'Authorization': 'Bearer ' + paramsVideo.tokenSh,
                'Content-Type': 'application/json'
            }
        },
        method: 'PUT',
        url: paramsVideo.server + '/api/v1/videos/' + paramsVideo.url,
        data: dataPut
    };

    ndlReq.needleReq(params2,(answer) =>{
        if (answer.statusCode === 204){
            console.log("успех");
            films.changeStatus(req, video.id, 2);
            // fs.unlink(paramsVideo.filePath, function(err){
            //     if (err) {
            //         console.log(err);
            //         console.log('::: Ошибка при удаление видео :::');
            //     } else {
            //         console.log("Файл удалён");
            //     }
            // });
        } else if (answer.statusCode === 401) {
            token.getToken(req, paramsVideo.token);
            console.log(answer.body);
            console.log('::: Ошибка авторизации :::');
            // Status Code ::400
        } else if (answer.statusCode === 403) {
            console.log(answer.statusCode);
            console.log('::: Ошибка при изменение видео :::');
        }  else {
            console.log(answer);
            console.log('::: Ошибка при изменение видео :::');
        }
    });
}

function serverSelection(req, tokenArray, filePath, tokenSh, video, serverClBc) {
    let params = {
        opts: {
            multipart: true,
            headers: {
                'Authorization': 'Bearer '+ tokenSh,
                'Content-Type': 'application/json',
            }
        },
        method: 'GET',
        url: 'https://showstreams.tv/api/v1/server/server_for_upload?videoLength=' + filePath,
        data: ''
    };
    function refresh() {
        serverSelection(req, tokenArray, filePath, tokenSh, video, serverClBc);
    }

    ndlReq.needleReq(params, (answer) => {
        if (answer === undefined) {

        } else if (answer.statusCode === 200) {
            serverClBc(answer.body.upload_host);
        } else if (answer.statusCode === 401) {
            token.getToken(req, tokenArray);
            console.log('::: Ошибка авторизации :::');
        } else {
            console.log(answer);
        }
    });
}

exports.controller = controller;
exports.uploadFile = uploadFile;
exports.getVideosInfoAndDownload = getVideosInfoAndDownload;
