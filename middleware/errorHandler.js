
var HttpError = require('./error').HttpError;
var log = require('./libs/log')(module);

module.exports = function(app) {
    app.use(function (err, req, res, next) {
        if (typeof err == 'number') {
            log.error("numberError: ", err);
            err = new HttpError(err);
        }
        if(err instanceof HttpError) {
            console.log("HttpError: ", err);
            sendHttpError(err,res);
        }
        else {
            if (app.get('env') === 'development') {
                log.error("DevError: ", err);
                res.status(err.status || 500);
                res.render("error", {
                    error: err
                });
            }
            else{
                console.log("UnKnowError: ", err);
                log.error(err);
                err = new HttpError(500);
                sendHttpError(err,res);
            }
        }
    });
};

function sendHttpError(error, res){
    if(res.req.headers['x-requested-with'] == 'XMLHttpRequest'){
        res.json(error);
    }
    else {
        res.render("error", {
            error: error
        });
    };
};

