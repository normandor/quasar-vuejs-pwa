const express = require('express')
const { initializeApp, applicationDefault, cert } = require('firebase-admin/app');
const { getFirestore, Timestamp, FieldValue, Filter } = require('firebase-admin/firestore');

const serviceAccount = require('./serviceAccountKey.json');

initializeApp({
  credential: cert(serviceAccount)
});

const db = getFirestore();

const app = express()
const port = 3000

app.get('/posts', (req, res) => {
  res.set('Access-Control-Allow-Origin', '*')
  let posts = []
  const snapshot = db.collection('posts')
  .orderBy('date', 'desc').get()
  .then(snapshot => {
    snapshot.forEach((doc) => {
      posts.push(doc.data())
    })
    res.send(posts)
  });
})

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`)
})