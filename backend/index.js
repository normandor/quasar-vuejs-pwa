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

const db = getFirestore();

const app = express();
const port = 3000;

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
        res.send('post added: ' + fields.id)
      })
    }
    // res.writeHead(303, { Connection: "close", Location: "/" });
  });
  req.pipe(bb);
});

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`);
});
