var express = require("express");
var app = express.Router();
const nodemailer = require("nodemailer");
var Users = require("../Models/user");
var Chat = require("../Models/ChatSchema");
var Buy = require("../Models/userProducts");

const bcrypt = require("bcrypt");
const saltRounds = 10;
const myPlaintextPassword = "s0//P4$$w0rD";
const someOtherPlaintextPassword = "not_bacon";

var http = require("http").Server(app);
var io = require("socket.io")(http, { transports: ["websocket", "polling"] });

// http.listen(4000, () => {
//   console.log("listening");
// });

require("dotenv/config");

const mongoose = require("mongoose");

const url =
  "mongodb+srv://Avengers8:RipunJay8@cluster0.prtvt.mongodb.net/Quick_Finder?retryWrites=true&w=majority";

mongoose.connect(
  url,
  { useNewUrlParser: true, useUnifiedTopology: true },
  (err) => {
    console.log("Connected to mongoose");
  }
);

const path = require("path");
const { ObjectId } = require("mongodb");

io.on("connection", (socket) => {
  console.log("a user is connected");
  console.log(socket.id);

  socket.on("notifications", (data) => {
    console.log("data", data);
    Chat.find({ chatId: data.room }).then((res) => {
      var not_arr = [];
      var arr = res[0]["mesDetails"];
      // console.log(arr);
      for (var i = 0; i < arr.length; i++) {
        console.log(arr[i].id, arr[i].seen);
        if (arr[i].id !== data.id && !arr[i].seen) {
          console.log("not seen", arr[i]);
          not_arr.push(arr[i]);
        }
      }
      socket.emit("check", not_arr);
    });
  });

  socket.on("join", (chatId) => {
    console.log("chatid", chatId);
    socket.join(chatId);
    Chat.findOne({ chatId: chatId }).then((result) => {
      if (result !== null) {
        socket.emit("allmessages", result.mesDetails);
      } else {
        Chat.findOne({ chatId: chatId }).then((result) => {
          if (result !== null) {
            socket.emit("allmessages", result.mesDetails);
          }
        });
      }
    });
  });

  socket.on("disconnect", () => {
    console.log("Disconnected");
  });

  socket.on("sent-message", (data) => {
    console.log(data);
    var chatId = "";
    message = data.data.message;
    chatId = data.data.room;
    id = data.data.id;
    var chatDocument = {
      message: message,
      time: new Date(),
      id: id,
      seen: false,
    };

    Chat.updateOne(
      { chatId: chatId },
      {
        $push: {
          mesDetails: {
            $each: [chatDocument],
          },
        },
      },
      { upsert: true }
    ).then(() => {
      socket.broadcast.to(chatId).emit("receive", message);
    });
  });

  socket.on("seen", (data) => {
    console.log(data.room, data.id);

    Chat.updateOne(
      { chatId: data.room },
      { $set: { "mesDetails.$[elem].seen": true } },
      { arrayFilters: [{ "elem.id": { $ne: data.id } }], multi: true }
    ).then((res) => {
      console.log(res);
    });
    // Chat.updateOne({ "chatId": data.room, "mesDetails.$[elem].id": data.id },
    //   {
    //     $set: {
    //       "mesDetails.$[elem].seen": true
    //     }
    //   }).then(res => {
    //     console.log("seen", res);
    //   })
  });
});

app.get("/try", (req, res) => {
  res.send("Working");
});

app.post("/login", async (req, res) => {
  const email = req.body.loginDetails.user_name;
  const pass = req.body.loginDetails.pass_word;

  var loggedin = false;

  await Users.find({ email: email }).then((result) => {
    bcrypt.compare(pass, result[0].password, function (err, password) {
      console.log(result);
      if (result[0].activated) {
        console.log("Done");
        loggedin = true;
        res.json({ mes: "Welcome", usern: result[0]._id });
      } else {
        loggedin = false;
        res.json({ mes: "regIssue" });
      }

      if (result === null) {
        console.log("Does not exist");
        res.json({ mes: "failed" });
      }
    });
  });
});

app.post("/signup", async (req, res) => {
  var uname = req.body.signupDetails.fname;
  var sname = req.body.signupDetails.lname;
  var password = req.body.signupDetails.password;
  var mobile = req.body.signupDetails.mobile;
  var email = req.body.signupDetails.email;
  var address = req.body.signupDetails.address;

  await bcrypt.hash(password, saltRounds, function (err, hash) {
    let personDocument = {
      name: uname,
      sname: sname,
      password: hash,
      mobile: mobile,
      email: email,
      address: address,
    };

    var user = new Users(personDocument);

    Users.findOne({ email: email }).then((result) => {
      console.log(result);
      if (result !== null) {
        console.log("User Existing");
      } else {
        try {
          user.save().then((result) => {
            var transporter = nodemailer.createTransport({
              service: "gmail",
              auth: {
                user: "quickfinder746@gmail.com",
                pass: "Quickfinder@746",
              },
            });

            var mailOptions = {
              from: "no reply",
              to: email,
              subject: "QUICK FINDER account activation.",
              html:
                '<a href="http://localhost:4000/activate/' +
                result._id +
                '">Click on the link to activate your account.</a>',
            };

            transporter.sendMail(mailOptions, function (error, info) {
              if (error) {
                console.log(error);
              } else {
                console.log("Email sent: " + info.response);
              }
            });
          });
        } catch (err) {
          console.log(err.stack);
        }
      }
    });
  });
});

app.get("/activate/:id", async (req, res) => {
  await Users.updateOne(
    { _id: ObjectId(req.params.id) },
    { $set: { activated: true } }
  ).then((result) => {
    res.send(result);
  });
});

/*
app.post('/buy', async (req, res) => {
  var buyerID = req.body.buyDetails.buyerID
  var sellerID = req.body.buyDetails.sellerID
  var productID = req.body.buyDetails.productID
  var datetime = req.body.buyDetails.DateTime

  let buyDocument = {
    "Time": datetime,
    "SellerId": new ObjectId("5ff5404a31512f1b0ad64a48"),
    "ProductId": new ObjectId("600c876d15877370d8e380b7")
  }
  console.log(buyDocument);

  await Buy.updateOne({ "_id": ObjectId(buyerID) },
    { $push: { purchased: buyDocument } },
    { upsert: true })

  console.log("buy Added");
  res.json({ mes: buyDocument });
})
*/

//expressapp.use("", app);
// expressapp.listen(4000, () => {
//   console.log("Server is running ");
// });
module.exports = app;
