const filmsCont = require('../controllers/films');

    function addNewFilm(req, video) {
    req.models.films.create([
        {title: video.title, original_id: video.id, link: video.link, status: 0}
    ], function (err, items) {
        if (err) console.log(err);
    })
}

function getLastFilm(req, options) {
        console.log('Я пришел за видео');
        req.models.films.find({status: 1}, function (err, check) {
            if (check.length === 0) {
                req.models.films.one({status: 0}, {order:'id'}, function (err, result) {
                    if (result.length !== 0) {
                        console.log(result.link);
                        filmsCont.getVideosInfoAndDownload(req, result.link, options);
                    }
                });
            } else {
                console.log('Уже есть в работе видео');
            }
        });
}

function checkById(req, video) {
    req.models.films.find({original_id: video.id}, function (err, results) {
        if (results.length === 0){
            addNewFilm(req, video);
        } else {
            return false;
        }
    });
}

function changeStatus(req, id, status) {
    req.models.films.one({original_id: id}, function (err, result) {
        result.status = status;
        result.save(function (err) {
            if (err) {
                console.log('Ошибка при смене статуса');
            }
        });
    });
}

exports.getLastFilm = getLastFilm;
exports.addNewFilm = addNewFilm;
exports.checkById = checkById;
exports.changeStatus = changeStatus;
