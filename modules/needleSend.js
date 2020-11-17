const needle = require('needle');

function needleReq(params,answer){
    needle.request(params.method, params.url, params.data, params.opts, function(error, response) {
        if (response === undefined){
            console.log('Ссылка - ' + params.url);
            console.log('Response undefined');
            console.log(error);
            answer(undefined);
        }else {
            if (response.statusCode === 200){
                answer(response);
            } else if (response.statusCode === 204){
                answer(response);
            } else if (response.statusCode === 400){
                console.log(params);
                console.log(response.body);
                console.log(response.statusCode);
            } else if (response.statusCode === 500){
                console.log(params);
                console.log(response.body.error);
                console.log(response.statusCode);
            } else {
                answer(response);
            }
        }
    });
}

exports.needleReq = needleReq;
