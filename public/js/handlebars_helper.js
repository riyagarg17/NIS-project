//loading User model
const mongoose=require('mongoose');
require('../../models/user');
const User=mongoose.model('user');


module.exports = {
  checkFriend: function (username) {
    
    var str=" ";
    User.find({"friendsList.friendName": username})
    .populate('user')
    .then(user=>{
      if(user)
					{
            
            if(user.length!=0)
              return "Start chat";
            else
              return "Add Friend";
          }
          
          
    });
     
  },
};