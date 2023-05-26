require("dotenv").config();
const express = require("express");
const app = express();
const bodyParser = require("body-parser");
const mongoose = require("mongoose");
const ejs = require("ejs");
const expressSession = require("express-session");
const passport = require("passport");
const passportLocalMongoose = require("passport-local-mongoose");

app.set('trust proxy', 1);
app.use(express.static(__dirname + "/public"));
app.use(bodyParser.urlencoded({extended:true}));
app.set("view engine", "ejs");
app.use(expressSession({
    secret:process.env.SECRET,
    saveUninitialized:false,
    resave:false,
    cookie:{
        httpOnly:true,
        secure:true
    }
}))

app.use(passport.initialize());
app.use(passport.session());

mongoose.set("strictQuery", false);
main().catch((err) => {console.log(err)});
async function main() {
    try {
        await mongoose.connect("mongodb://127.0.0.1:27017/blog-assessmentDB");
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

    const users = new mongoose.model("users", userSchema);
    passport.use(users.createStrategy());
    passport.serializeUser((user, done) => {
        done(null, user);
    });
    passport.deserializeUser((user, done) => {
        done(null, user);
    })




    app.get("/", (request, respose) => {
        respose.render("Home");
    })

    app.get("/signUp", (request, response) => {
        response.render("SignUp")
    })

    app.post("/signUp", (request,response) => {
        var {fullname, username, password} = request.body;
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
    })

    app.get("/signIn", (request, response) => {
        response.render("signIn");
    });

    app.post("/signIn", (request, response) => {
        var {username, password} = request.body;
        var currentUser = new users ({
            username:username,
            password:password
        })
        request.logIn(currentUser, (err) => {
            if(err) {
                console.log(err);
            }else{
                passport.authenticate("local", 
                {failureRedirect:"/signIn",
                failWithError:false, 
                failureMessage:"Incorrectusername or password"})
                (request, response, (err) => {
                    if(err) {
                        console.log(err);
                        const body = "username or password is incorrect"
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
    });
 
    app.get("/blogs", async (request, response) => {
        var {username,fullname} = request.session.passport.user;
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
        }
    });

    app.post("/blogs", async (request, response) => {
        var {username,fullname} = request.session.passport.user;
        var {comment, submit, title, content, addcomment, like} = request.body
        console.log(addcomment);
       
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
        }else if (submit) {
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
    });

    app.get("/logOut", (request, response) => {
        request.logOut((err) => {
            if(err){
                console.log(err)
            }else{
                console.log("Logged Out");
                response.redirect("/");
            }
        })
    })

    app.listen(process.env.PORT || "600", () => {
        console.log("Running on port 600");
    })

}





    

