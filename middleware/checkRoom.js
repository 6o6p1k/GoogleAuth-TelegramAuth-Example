var HttpError = require('./error').HttpError;
var User = require('./models/user').User;





module.exports = function(req, res, next) {
    var checkRoom = require('./../socket').cR(req.params.id);
    if (checkRoom.roomEnable == false) {
        return next(new HttpError(404, "Invalid room id. Check the correctness of the entered id."));
    };
    if(checkRoom.clientNum >= 2) {
        console.log("checkRoom middleware numberOfClient: ",checkRoom.clientNum);
        return next(new HttpError(403, "The room is already full. Try to create a new room for personal communication."));
    };
    next();
};