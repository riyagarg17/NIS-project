const express = require("express");
const socket = require("socket.io");
const forge = require("node-forge");
const exphbs=require('express-handlebars');
const util = require("./utils/primitive-root");
const session = require('express-session');
const passport=require('passport');
const mongoose=require('mongoose');
const bcrypt=require('bcryptjs');
const bodyParser = require('body-parser');
const flash = require('connect-flash');
const {ensureAuthenticated}=require('./config/auth');
const {checkFriend}=require('./public/js/handlebars_helper');
const async = require('async');
//require('dotenv').config();

// passport config 
require('./config/passport')(passport);

//connect to mongoose
mongoose.connect("mongodb://localhost:27017/chat", { useNewUrlParser: true ,useUnifiedTopology: true})
.then(()=>console.log('Connected'))
.catch(err=>console.log('Couldn\'t connect',err));

const app = express();
const server = app.listen(3300, () => {
	console.log("Listening at port 3300");
});

// Static files
app.use(express.static("public"));

//express-session middleware
app.use(session({
    secret: 'secret',
    resave: true,
    saveUninitialized: true,
  }));

//passport middleware
app.use(passport.initialize());
app.use(passport.session());

//flash middleware
app.use(flash());


//custom middleware
app.use(function(req,res,next){
    res.locals.success_msg=req.flash('success_msg');
    res.locals.error_msg=req.flash('error_msg');
    res.locals.user=req.user || null;
    res.locals.error = req.flash('error');
    next();
});

  //bodyParser middleware
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

//load handlebars middleware
app.engine('handlebars',exphbs(
	{
		helpers:{
			checkFriend:checkFriend,
		},
		defaultLayout:'main'
	}));
app.set('view engine','handlebars');

//loading User model
require('./models/user');
const User=mongoose.model('user');

// Socket setup
const io = socket(server);

io.on("connection", socket => {
	console.log("Conn. established");
	console.log("Socket", socket.id);

	let q, p;
	const bits = 8;
	const a = Math.floor(Math.random() * 9) + 1;
	console.log("a", a);
	// Generate p and q
	[p, q] = util.genPrimes();

	// 1.) Send p & q to client
	socket.on("request", data => {
		console.log("q", q, "p", p);
		socket.emit("request", {
			q: q,
			p: p
		});
	});

	// 3.) Exchange A & B
	socket.on("exchange", data => {
		console.log("B:", data);
		const B = data;
		// 2.) Calculate A = q^a mod p
		const A = Math.pow(q, a) % p;
		// Calculate K(a) = B^a mod p
		const K_a = Math.pow(B, a) % p;
		// Send A and K_a to client
		socket.emit("exchange", {
			K_a: K_a,
			A: A
		});
	});

	// Handle chat event
	socket.on("chat", data => {
		io.sockets.emit("chat", data);
	});

	// Handle typing event
	socket.on("typing", data => {
		socket.broadcast.emit("typing", data);
	});
});

//first page
app.get('/home',(req,res)=>{

    res.render('home');
});

app.get('/login',(req,res)=>{

    res.render('login');
});

app.post('/login',(req,res,next)=>{
	passport.authenticate('local',{

        successRedirect:'/search',
        failureRedirect:'/login',
        failureFlash:true,
    })(req,res,next);
});

app.post('/user/register',(req,res)=>{

	var errors=[];
	var hasUpperCase = "[A-Z]";
	var hasLowerCase = "[a-z]";
	var hasNumbers = "[0-9]";
	var hasNonalphas = "[-!$%^&*()_+|~=`{}\[\]:\/;<>?,.@#]";
	console.log(req.body.password);
	if (req.body.password.length<4)
		errors.push({text:'password must be greater than 4 characters'});
	if (req.body.password.length>20)
		errors.push({text:'password must be less than 20 characters'});
	if(req.body.password.match(hasUpperCase)==null)
		errors.push({text:'password must contain an uppercase character'});
	if(req.body.password.match(hasLowerCase)==null)
		errors.push({text:'password must contain a lowercase character'});
	if(req.body.password.match(hasNumbers)==null)
		errors.push({text:'password must contain a number'});
	if(/^[a-zA-Z0-9- ]*$/.test(req.body.password) == true)
		errors.push({text:'password must contain a special character'});
	if(errors.length>0){

			res.render('home',{
	
				errors:errors,
				userName:req.body.userName,
				email:req.body.email,
				password:req.body.password,

			});
		}
		else{
        
			User.findOne({email: req.body.email})
			.then(user=>{
	
				if(user)
					{
						req.flash('error_msg','User already exists!');
					}
				else{
					
					const newUser={
	
						name:req.body.userName,
						email:req.body.email,
						password:req.body.password,
					};
			
					bcrypt.genSalt(10,(err,salt)=>{
						bcrypt.hash(newUser.password,salt,(err,hash)=>{
							if(err) throw err;
							newUser.password=hash;
							new User(newUser).save()
							.then(user=>{
								req.flash('success_msg','User registered!');
								res.redirect('/login');
							})
							.catch(err=>{
								return;
							});
						});
					});
				}
			});    
		}
});


app.get('/Achat',(req,res)=>{
	
	
	res.render('chat',{layout: 'chatBack'});
});

//logout user
app.get('/logout',(req,res)=>{
    req.logout();
    req.flash('success_msg','Logged out successfully!');
    res.redirect('/login');
});

//user profile page
app.get('/profile',ensureAuthenticated,(req,res)=>{

    res.render('profile');
});

//delete account route
app.delete('/:id',ensureAuthenticated,(req,res)=>{
    User.findByIdAndRemove(req.params.id)
        .then(user => {
            req.flash('success_msg', 'Sucessfully deleted!');
            res.redirect('/');
        });                                                                         
});

//load search page
app.get('/search', ensureAuthenticated, function(req, res){
	//console.log("search clicked");
	var sent =[];
	var friends= [];
	var received= [];
	received= req.user.request;
	sent= req.user.sentRequest;
	friends= req.user.friendsList;

	User.find({name: {$ne: req.user.name}}, function(err, result){
		if (err) throw err;
		
		res.render('search',
		{
			layout: 'chatBack',
			result: result,
			sent: sent,
			friends: friends,
			received: received
		});
	});
});

//load search results
app.post('/search', ensureAuthenticated, function(req, res) {
	 var searchfriend = req.body.searchfriend;
   if(searchfriend) {
		var mssg= '';
	   if (searchfriend == req.user.name) {
		   searchfriend= null;
	   }
	    User.find({name: searchfriend}, function(err, result) {
		    if (err) throw err;
			    res.render('search', {
				layout: 'chatBack',
			    result: result,
				mssg : mssg
		    });
      	});	
   }
	
	async.parallel([
	   function(callback) {
		   if(req.body.receiverName) {
				   User.update({
					   'name': req.body.receiverName,
					   'request.userId': {$ne: req.user._id},
					   'friendsList.friendId': {$ne: req.user._id}
				   }, 
				   {
					   $push: {request: {
					   userId: req.user._id,
					   name: req.user.name
					   }},
					   $inc: {totalRequest: 1}
					   },(err, count) =>  {
						   console.log(err);
						   callback(err, count);
					   });
		   }
	   },
	   function(callback) {
		   if(req.body.receiverName){
				   User.update({
					   'name': req.user.name,
					   'sentRequest.name': {$ne: req.body.receiverName}
				   },
				   {
					   $push: {sentRequest: {
					   name: req.body.receiverName
					   }}
					   },(err, count) => {
					   callback(err, count);
					   });
		   }
	   }],
   (err, results)=>{
	   res.redirect('/search');
   });

		   async.parallel([
			   // this function is updated for the receiver of the friend request when it is accepted
			   function(callback) {
				   if (req.body.senderId) {
					   User.update({
						   '_id': req.user._id,
						   'friendsList.friendId': {$ne:req.body.senderId}
					   },{
						   $push: {friendsList: {
							   friendId: req.body.senderId,
							   friendName: req.body.senderName
						   }},
						   $pull: {request: {
							   userId: req.body.senderId,
							   name: req.body.senderName
						   }},
						   $inc: {totalRequest: -1}
					   }, (err, count)=> {
						   callback(err, count);
					   });
				   }
			   },
			   // this function is updated for the sender of the friend request when it is accepted by the receiver	
			   function(callback) {
				   if (req.body.senderId) {
					   User.update({
						   '_id': req.body.senderId,
						   'friendsList.friendId': {$ne:req.user._id}
					   },{
						   $push: {friendsList: {
							   friendId: req.user._id,
							   friendName: req.user.username
						   }},
						   $pull: {sentRequest: {
							   name: req.user.name
						   }}
					   }, (err, count)=> {
						   callback(err, count);
					   });
				   }
			   },
			   function(callback) {
				   if (req.body.user_Id) {
					   User.update({
						   '_id': req.user._id,
						   'request.userId': {$eq: req.body.user_Id}
					   },{
						   $pull: {request: {
							   userId: req.body.user_Id
						   }},
						   $inc: {totalRequest: -1}
					   }, (err, count)=> {
						   callback(err, count);
					   });
				   }
			   },
			   function(callback) {
				   if (req.body.user_Id) {
					   User.update({
						   '_id': req.body.user_Id,
						   'sentRequest.name': {$eq: req.user.name}
					   },{
						   $pull: {sentRequest: {
							   name: req.user.name
						   }}
					   }, (err, count)=> {
						   callback(err, count);
					   });
				   }
			   } 		
		   ],(err, results)=> {
			   res.redirect('/search');
		   });
});

app.get('/user/friends',ensureAuthenticated,(req,res)=>{
    /*User.find(req.params.id)
        .then(user => {
            req.flash('success_msg', 'Sucessfully deleted!');
            res.redirect('/');
		});   */
		res.render('friends',{
			result:req.user.friendsList,
			layout: 'chatBack'
		});                                                                     
})
