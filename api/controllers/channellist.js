const needle = require('needle'),
      env = require("../../app/config/env");

const films = require('../models/films');
const some = require('../../test');

function controller(req, res) {
    films.getLastFilm(req, res);
    // some.uploadLastVideo(req);
}

exports.controller = controller;
