const mongoose=require('mongoose');


//db config
/*const db=require('../config/database');

mongoose.connect(db.mongoURI, { useNewUrlParser: true })
.then(()=>console.log(db.mongoURI))
.catch(err=>console.log('Couldn\'t connect',err));*/


//creating schema
const userSchema=new mongoose.Schema({
    
    name:{
        type:String,
        required:true
    },
    email:{
        type:String,
        required:true
    },
    password:{
        type:String,
        required:true
    },
    date:{
        type:Date,
        default: Date.now()
    },
	sentRequest:[{
	    name: {type: String, default: ''}
	}],
	request: [{
		userId: {type: mongoose.Schema.Types.ObjectId, ref: 'user'},
		name: {type: String, default: ''}
	}],
	friendsList: [{
		friendId: {type: mongoose.Schema.Types.ObjectId, ref: 'user'},
		friendName: {type: String, default: ''}
	}],
	totalRequest: {type: Number, default:0}
    
});

mongoose.model('user',userSchema,'user');


