require("dotenv").config();
const express = require("express");
const app = express();
const bodyParser = require("body-parser");
const findOrCreate = require("./findOrCreate");
const mongoose = require("mongoose");
const ejs = require("ejs");
const expressSession = require("express-session");
const passport = require("passport");
const passportLocalMongoose = require("passport-local-mongoose");
const connectEnsureLogin = require("connect-ensure-login");
const GoogleStrategy = require("passport-google-oauth20").Strategy;

app.set('trust proxy', 1);
app.use(express.static(__dirname + "/public"));
app.use(bodyParser.urlencoded({extended:true}));
app.set("view engine", "ejs");
app.use(expressSession({
    secret:process.env.SECRET,
    saveUninitialized:true,
    resave:false
}))

app.use(passport.initialize());
app.use(passport.session());

mongoose.set("strictQuery", false);
main().catch((err) => {console.log(err)});
async function main() {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log("sucess")
    }catch(err) {
        console.log(err);
    }

    // All through this module, username === email 
    const blogSchema = new mongoose.Schema({
        blog:[{
            author:{
                fullname:String,
                username:String
            },
            title:String,
            content:String,
            comments:[Object],
            views: [String],
            likes:[String]
        }]
    });

    const blogs = new mongoose.model("blogs", blogSchema)

    const userSchema = new mongoose.Schema({
        username:String,
        fullname:String,
        password:String
    })

    userSchema.plugin(passportLocalMongoose);
    userSchema.plugin(findOrCreate);
    const users = new mongoose.model("users", userSchema);
    passport.use(users.createStrategy());
    passport.serializeUser((user, done) => {
        done(null, user);
    });
    passport.deserializeUser((user, done) => {
        done(null, user);
    })


    passport.use(new GoogleStrategy({
        clientID: process.env.CLIENT_ID,
        clientSecret: process.env.CLIENT_SECRET,
        callbackURL: "https://angry-clam-galoshes.cyclic.app/auth/google/blogs",
        userProfileURL: "https://www.googleapis.com/oauth2/v3/userinfo"
      },
      function(accessToken, refreshToken, profile, cb) {
        console.log(profile);
        users.findOrCreate({username:profile.emails[0].value, fullname:profile.name.familyName + " " + profile.name.givenName}, function (err, users) {
          return cb(err, users);
        });
      }
    ));

   

    app.get("/", (request, respose) => {
        respose.render("home");
    })

    app.get("/signUp", (request, response) => {
        response.render("signUp")
    })
    app.get("/auth/google",
        passport.authenticate("google", { scope: ["profile","email"] })
    );

    app.get("/auth/google/blogs",
        passport.authenticate("google", { failureRedirect: "/signIn" }),
        function(request, response) {
        response.redirect("/blogs");
    });

    app.post("/signUp", (request,response) => {
        var {fullname, username, password} = request.body;
        try{
            users.register({username:username,fullname:fullname}, password, (err) => {
                if(err) {
                    console.log(err);
                    const body = "username is already taken"
                    response
                    .writeHead(401, {
                        'Content-Length': Buffer.byteLength(body),
                        'Content-Type': 'text/plain'
                    }).end(body);
                }else{
                    response.redirect("/signIn")
                }
            })
        }catch(err) {
            console.log(err);
            response.redirect("/signUp");
        }
        
    })

    app.get("/signIn", (request, response) => {
        response.render("signIn");
    });

    app.post("/signIn", async (request, response) => {
        const {username, password} = request.body;
        try{
            var currentUser = new users ({
                username:username,
                password:password
            })
            request.logIn(currentUser, async(err) => {
                if(err) {
                    console.log(err);
                }else{
                    await passport.authenticate("local", 
                    {failureRedirect:"/signIn",
                    failWithError:false, 
                    failureMessage:"Incorrectusername or password"})
                    (request, response, (err) => {
                        if(err) {
                            console.log(err);
                            const body = "Incorrectusername or password"
                            response
                            .writeHead(401, {
                                'Content-Length': Buffer.byteLength(body),
                                'Content-Type': 'text/plain'
                            })
                            .end(body);
                        }else{
                            response.redirect("/blogs");
                        }
                        
                    })
                }
            })
        }catch(err){
            console.log(err);
            response.redirect("/signIn");
        }
        
    });
 
    app.get("/blogs", connectEnsureLogin.ensureLoggedIn("/signIn"), async (request, response) => {
        const {username,fullname} = request.user;
        try{
            if(request.isAuthenticated) {
                await blogs.find({}).then((foundBlogs) => {
                    foundBlogs.forEach((blogss) => {
                        var checkViews = blogss.blog[0].views.includes(username)
                        if(!checkViews){
                        var addViews =  blogss.blog[0].views.push(username);
                        blogss.save();
                        }
                        
                    });
                    
                    response.render("blogs", {requestedBlogs:foundBlogs});
                }).catch((err) => {
                    console.log(err);
                })
            }else if(request.session.pasport.user === null){
                response.redirect("/signIn");
            }
        }catch(err) {
            console.log(err);
            response.redirect("/signIn");
        }
        
    });

    app.post("/blogs", async (request, response) => {
        const {username,fullname} = request.user;
        var {comment, submit, title, content, addcomment, like} = request.body
        console.log(addcomment);
        try{
            if(addcomment) {
                var commentDetails = {
                    user:fullname,
                    comment:comment
                }
                await blogs.findOne({_id:addcomment}).then((foundDocument) => {
                foundDocument.blog[0].comments.push(commentDetails);
                foundDocument.save();
                response.redirect("/blogs");
                }); 
            }else if (newblog) {
                var newBlog = new blogs ({
                    blog:[{
                        author:{
                            fullname:fullname,
                            username:username
                        },
                        title:title,
                        content:content 
                    }]
                })
                await newBlog.save();
                response.redirect("/blogs");
            }else if(like){
                await blogs.findOne({_id:like}).then((foundDocument) => {
                    var checkLikes = foundDocument.blog[0].likes.includes(username);
                    if(!checkLikes){
                        foundDocument.blog[0].likes.push(username);
                        foundDocument.save();
                    }
                    response.redirect("/blogs");
                }).catch((err) => {
                    console.log(err);
                }); 
            }else{
                response.render("home");
            }
        }catch(err){
            console.log(err);
            response.redirect("/blogs")
        }
        
    });

    app.get("/logOut", async (request, response) => {
        try{
            request.logOut((err) => {
                if(err){
                    console.log(err)
                }else{
                    console.log("Logged Out");
                    response.redirect("/");
                }
            })
        }catch(err) {
            console.log(err);
            response.redirect("/");
        }
        
    })

    app.listen(process.env.PORT || "3000", () => {
        console.log("Running on port 3000");
    })

}





    

