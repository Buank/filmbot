const films = require("../api/controllers/films"),
      ndlReq = require('../modules/needleSend');

function getToken(req,tokenArray) {
    let data = {
        client_id: '69qx8xhcn6idwuchd88m5deiwulaefkp',
        client_secret: 'FJoeVT5Y38PL6k1hQsqWfmPvlfMJhaoU',
        response_type: 'code',
        grant_type: 'password',
        scope: 'upload',
        username: 'system',
        password: '123321qwwq',
    };

    let params = {
        method:'POST',
        url:'https://showstreams.tv/api/v1/users/token',
        data:data
    };

    ndlReq.needleReq(params,(answer)=>{
        if (answer.statusCode === 200){
            rewrite(req,answer.body.access_token,tokenArray);
        }else {
            console.log(answer.statusCode);
            console.log('::: Ошибка при получение токена :::');
        }
    });
}

function rewrite(req,newToken,tokenArray) {
    req.models.params.find({id:1},function (err, results) {
        results[0].token = newToken;
        results[0].save(function (err) {
            if (err){
                console.log('Ошибка записи токена');
            }
            if (tokenArray.marker === 'uploadFile'){
                films.uploadFile(tokenArray.video,tokenArray.req);
            }
        });
    });
}

function readTokenSh(req,callback){
    req.models.params.find({id:1},function (err, results) {
        callback(results[0].token);
    });
}

exports.readTokenSh = readTokenSh;
exports.getToken = getToken;
