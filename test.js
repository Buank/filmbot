const fetch = require('node-fetch');
const needle = require('needle');
const url = require('url');
const http = require('http');
const fs = require('fs');
const cheerio = require('cheerio');
const HttpsProxyAgent = require('https-proxy-agent');
const films = require('./api/models/films');
let imaps = require('imap-simple');

let config = {
    imap: {
        user: 'wsi2007@mail.ru',
        password: 'Nonire239z',
        host: 'imap.mail.ru',
        port: 993,
        tls: true
    }
};
exports.uploadLastVideo = uploadLastVideo;
async function uploadLastVideo(req) {
    needle.get('https://kino.pub/user/login', { "agent": new HttpsProxyAgent('http://127.0.0.1:9911/'), }, function(err, resp, body) {
        authToPub(req, resp);
    });
}

async function authToPub(req, get_resp, formcode = '') {
    const regex = /name="_csrf" value="([a-zA-Z0-9_\-=]+)">/;

    let str = await get_resp.body;
    let csrf = regex.exec(str)[1];
    let cookies = get_resp.headers['set-cookie'].toString();
    const data = {
        '_csrf': csrf,
        'login-form[login]': 'buank',
        'login-form[password]': 'gfhjkm2057',
        'login-form[rememberMe]': "1"
    };

    if (formcode !== '') {
        data['login-form[formcode]'] = formcode;
    }

    let requestOptions = {
        method: 'POST',
        agent: new HttpsProxyAgent('http://127.0.0.1:9911/'),
        headers: {
            "Cookie": cookies.replace(/(path=\/; HttpOnly(,|$))/,''),
            "Content-Type": "application/x-www-form-urlencoded",
        },
        redirect: 'follow'
    };

    needle.post('https://kino.pub/user/login', data, requestOptions, function(err, resp) {
        if (resp.statusCode === 200 && formcode === '') {
            getFormcode(req, get_resp);
        }
        if (resp.statusCode === 302 && formcode !== '') {
            getVideoList(req, resp.headers['set-cookie'].toString());
        }
    });
}

function getFormcode(req, get_resp, formcode = '') {
    setTimeout(async function () {
        formcode = await goToMail().then((res) => {
            return res;
        });
        if (formcode !== '') {
            authToPub(req, get_resp, formcode);
        }
    },2000);
}

async function goToMail() {
    let regex = /<strong>(\d+)<\/strong>/;
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

function getVideoList(req, cookie) {
    let options = {
        "agent": new HttpsProxyAgent('http://127.0.0.1:9911/'),
        "headers": {
            "Cookie": cookie.replace(/(path=\/; HttpOnly(,|$))/g,''),
            "Content-Type": "application/x-www-form-urlencoded",
        }
    };
    needle.get('https://kino.pub/new', options, function(err, resp, body) {
        let videoList = [];
        let $ = cheerio.load(body);
        let links = $("div.item-title > a");
        $(links).each(function(i, link){
            videoList.push($(link).attr('href'));
        });
        getVideosInfo(req, videoList, options)
    });
}

async function getVideosInfo(req, videoList, options) {
    for (let link of videoList) {
        console.log(link);
        needle.get('https://kino.pub' + link, options, async function (err, resp, body) {
            let $ = await cheerio.load(body),
                title = $("title").text(),
                link = $("a:contains('720p')").attr('href');

            films.addNewFilm(req, title, link)
        });
    }
}

function downloadVideo(video) {
    // Тут качаем файл из базы
    // Эта штука должна работать по крону
    // console.log(video);
    // let file_name = 'wejlhgfd.mp4';
    // let file = fs.createWriteStream('./video/' + file_name);
    // let out = fs.createWriteStream(file_name);
    // needle.get(video, options).pipe(out).on('finish', function() {
    //     console.log('Pipe finished!');
    // });
}
