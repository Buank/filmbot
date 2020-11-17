let needle = require('needle'),
    cheerio = require('cheerio'),
    agent = require('secure-random-user-agent');

needle.defaults({
    user_agent: agent(),
    // proxy : '54.39.235.234:3128',
    follow_set_referer      : true,
    follow_if_same_host     : true,
    follow_if_same_protocol : true,
    follow_max: 3
});

// 54.39.235.234:3128
// proxy : '103.102.73.25:8080',

let url = 'https://www.youtube.com/feed/trending';

function trendYoutube(callback){
    needle.get(url, function(error, response) {
        if (response === undefined){
            // file.removeProxy(file.proxyServer());
            trendYoutube(callback);
        }else {
            if (response.statusCode === 200){
                $ = cheerio.load(response.body);
                let linkTrend = $('a.yt-uix-tile-link'),
                    listTrends = {};
                linkTrend.each(function (i,val) {
                    listTrends[i] = 'https://www.youtube.com'+ $(val).attr('href');
                });
                callback(listTrends);
            }else {
                // file.removeProxy(file.proxyServer());
                trendYoutube(callback);
            }
        }
    });
}


exports.trendYoutube = trendYoutube;