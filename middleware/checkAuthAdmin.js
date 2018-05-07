var HttpError = require('./error').HttpError;

module.exports = function(req, res, next) {
    console.log("checkAuthAdmin: ", req.session.user);
    if (req.session.user != '5a97c4eb0d1b2b07281cda93') {
        return next(new HttpError(401, "you are not authorized like Administrator"));
    }

    next();
};