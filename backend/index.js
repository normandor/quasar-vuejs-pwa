const express = require("express");
const {
  initializeApp,
  applicationDefault,
  cert,
} = require("firebase-admin/app");
const {
  getFirestore,
  Timestamp,
  FieldValue,
  Filter,
} = require("firebase-admin/firestore");

const { getStorage } = require('firebase-admin/storage');

const serviceAccount = require("./serviceAccountKey.json");

const firebaseApp = initializeApp({
  credential: cert(serviceAccount),
  storageBucket: 'vue-quasar-tuto.appspot.com'
});

const bucket = getStorage(firebaseApp).bucket();

const busboy = require("busboy");
let path = require('path')
let os = require('os')
let fs = require('fs')
let UUID = require('uuid-v4')
let webpush = require('web-push')

const db = getFirestore();

const app = express();
const port = 3000;

webpush.setVapidDetails(
  'mailto:test@test.com',
  'BG4Dtbzl48JZsd5yJIXNufu_k98856Y1GeNNogj5JSSee452e_O7EDs9XfOtxvKvwOWm6GK5Zz9K5D98cJCh4oA',
  'dummy'
);

app.get("/posts", (req, res) => {
  res.set("Access-Control-Allow-Origin", "*");
  let posts = [];
  const snapshot = db
    .collection("posts")
    .orderBy("date", "desc")
    .get()
    .then((snapshot) => {
      snapshot.forEach((doc) => {
        posts.push(doc.data());
      });
      res.send(posts);
    });
});

app.post("/createPost", (req, res) => {
  res.set("Access-Control-Allow-Origin", "*");
  let uuid = UUID()

  const bb = busboy({ headers: req.headers });
  let fields = {}
  let fileData = {}

  bb.on('file', (name, file, info) => {
    const { filename, encoding, mimeType } = info;
    console.log(
      `File [${name}]: filename: %j, encoding: %j, mimeType: %j`,
      filename,
      encoding,
      mimeType
    );
    let filepath = path.join(os.tmpdir(), filename)
    fileData = {
      path: filepath,
      mimeType: mimeType
    }
    file.pipe(fs.createWriteStream(filepath))
    file
      .on("data", (data) => {
        console.log(`File [${name}] got ${data.length} bytes`);
      })
      .on("close", () => {
        console.log(`File [${name}] done`);
      });
  });
  bb.on("field", (name, val, info) => {
    fields[name] = val
  });
  // on "finish"
  bb.on("close", () => {
    console.log('filedata', fileData)
    bucket.upload(
      fileData.path,
      {
        uploadType: 'media',
        metadata: {
          metadata: {
            content: fileData.mimeType,
            firebaseStorageDownloadTokens: uuid,
          }
        }
      },
      (err, uploadedFile) => {
        if (!err) {
          createDocument(uploadedFile)
        }
      }
    );

    function createDocument(uploadedFile) {
      db.collection('posts').doc(fields.id).set({
        id: fields.id,
        caption: fields.caption,
        location: fields.location,
        date: parseInt(fields.date),
        imageUrl: `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${uploadedFile.name}?alt=media&token=${uuid}`
      })
      .then(() => {
        sendPushNotification()
        res.send('post added: ' + fields.id)
      })
    }

    function sendPushNotification() {
      let subscriptions = []
      db.collection('subscriptions')
        .get()
        .then((snapshot) => {
          snapshot.forEach((doc) => {
            subscriptions.push(doc.data());
          });
          return subscriptions
        }).then(subscriptions => {
          subscriptions.forEach(subscription => {
            const pushSubscription = {
              endpoint: subscription.endpoint,
              keys: {
                auth: subscription.keys.auth,
                p256dh: subscription.keys.p256dh
              }
            };
            let pushContent = {
              title: 'New Quasagram post', 
              body: 'New post added!'
            }
            webpush.sendNotification(pushSubscription, JSON.stringify(pushContent));
          })
        })
    }
    // res.writeHead(303, { Connection: "close", Location: "/" });
  });
  req.pipe(bb);
});

app.post("/createSubscription", (req, res) => {
  res.set("Access-Control-Allow-Origin", "*");
  db.collection('subscriptions').add(req.query).then(docRef => {
    res.send({
      message: 'Subscription added',
      postData: req.query
    })
  })

});

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`);
});
