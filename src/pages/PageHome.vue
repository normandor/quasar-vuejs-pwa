<template>
  <q-page class="constrain q-pa-md">
  <transition
      appear
      enter-active-class="animated fadeIn"
      leave-active-class="animated fadeOut"
    >
      <div
        v-if="pushNotificationsSupported && showNotificationsBanner"
        class="banner-container bg-primary"
      >
        <div class="constrain">
          <q-banner
            class="bg-grey-3 q-mb-md"
            inline-actions
          >
            <template v-slot:avatar>
              <q-icon
                name="eva-bell-outline"
                color="primary"
              />
            </template>

            Would you like to enable notifications?

            <template v-slot:action>
              <q-btn
                @click="enableNotifications"
                label="Yes"
                color="primary"
                class="q-px-sm"
                flat
              />
              <q-btn
                @click="showNotificationsBanner = false"
                label="Later"
                color="primary"
                class="q-px-sm"
                flat
              />
              <q-btn
                @click="neverShowNotificationsBanner"
                label="Never"
                color="primary"
                class="q-px-sm"
                flat
              />
            </template>
          </q-banner>
        </div>
      </div>
    </transition>
    <div class="row q-col-gutter-lg">
      <div class="col-12 col-sm-8">
        <template v-if="!loadingPosts && posts.length">
          <q-card
            v-for="post in posts"
            :key="post.id"
            class="card-post q-mb-md"
            :class="{ 'bg-red-1' : post.offline }"
            bordered
            flat
          >
          <q-badge v-if="post.offline" color="red"
          class="absolute-top-right badge-offline"
          >
            Offline
          </q-badge>
            <q-item>
              <q-item-section avatar>
                <q-avatar>
                  <img src="https://cdn.quasar.dev/img/boy-avatar.png">
                </q-avatar>
              </q-item-section>

              <q-item-section>
                <q-item-label class="text-bold">@username</q-item-label>
                <q-item-label caption>
                  {{ post.location }}
                </q-item-label>
              </q-item-section>
            </q-item>
            <q-separator />
            <q-img :src="post.imageUrl" />
            <q-card-section>
              <div>{{ post.caption }}</div>
              <div class="text-caption text-grey">{{ post.date | niceDate }}</div>
            </q-card-section>
          </q-card>
        </template>


        <template v-else-if="!loadingPosts && !posts.length">
          <h5 class="text-center text-grey">
            No posts yet
          </h5>
        </template>

        <template v-else>
          <q-card class="q-mb-md" flat bordered v-for="index in 3" :key="index">
            <q-item>
              <q-item-section avatar>
                <q-skeleton size="40px" type="QAvatar" animation="fade" />
              </q-item-section>

              <q-item-section>
                <q-item-label>
                  <q-skeleton type="text" animation="fade" />
                </q-item-label>
                <q-item-label caption>
                  <q-skeleton type="text" animation="fade" />
                </q-item-label>
              </q-item-section>
            </q-item>

            <q-skeleton height="200px" square animation="fade" />

            <q-card-section>
              <q-skeleton type="text" class="text-subtitle2" animation="fade" />
              <q-skeleton type="text" width="50%" class="text-subtitle2" animation="fade" />
            </q-card-section>
          </q-card>
        </template>
      </div>


      <div class="col-4 large-screen-only">
        <q-item class="fixed">
          <q-item-section avatar>
            <q-avatar size="48px">
              <img src="https://cdn.quasar.dev/img/boy-avatar.png">
            </q-avatar>
          </q-item-section>

          <q-item-section>
            <q-item-label class="text-bold">@username</q-item-label>
            <q-item-label caption>
              Jhn Doe
            </q-item-label>
          </q-item-section>
        </q-item>
      </div>
    </div>

  </q-page>
</template>

<script>
import { date } from 'quasar'
import { openDB } from 'idb'
let qs = require('qs')

export default {
  name: 'PageHome',
  data() {
    return {
      posts: [],
      loadingPosts: false,
      showNotificationsBanner: false
    }
  },
  computed: {
    serviceWorkerSupported() {
      return 'serviceWorker' in navigator
    },
    pushNotificationsSupported() {
      return 'PushManager' in window
    }
  },
  methods: {
    getPosts() {
      this.loadingPosts = true
      this.$axios.get(`${ process.env.API }/posts`)
        .then(response => {
          this.posts = response.data
          this.loadingPosts = false
          if (!navigator.onLine) {
            this.getOfflinePosts()
          }
        })
        .catch(err => {
                    this.$q.dialog({
            title: 'Error',
            message: 'Could not fetch posts'
          })
          this.loadingPosts = false
        })
    },
    getOfflinePosts() {
      let db = openDB('workbox-background-sync').then(db => {
        db.getAll('requests').then(failedRequests => {
          failedRequests.forEach(failedRequest => {
            if (failedRequest.queueName == 'createPostQueue') {
              let request = new Request(failedRequest.requestData.url, failedRequest.requestData)
              request.formData().then(formData => {
                let offlinePost = {}
                offlinePost.id = formData.get('id')
                offlinePost.caption = formData.get('caption')
                offlinePost.location = formData.get('location')
                offlinePost.date = parseInt(formData.get('date'))
                offlinePost.offline = true

                let reader = new FileReader()
                reader.readAsDataURL(formData.get('file'))
                reader.onloadend = () => {
                  offlinePost.imageUrl = reader.result
                  this.posts.unshift(offlinePost)
                }
              })
            }
          })
        }).catch(err => {
          console.log('error accessing indexed db');
        })
      })
    },
    listenForOfflinePostUploaded() {
      if (this.serviceWorkerSupported) {
        const channel = new BroadcastChannel('sw-messages');
        channel.addEventListener('message', event => {
            if (event.data.msg == 'offline-post-uploaded') {
              let offlinePostCount = this.posts.filter(post => post.offline == true).length
              this.posts[offlinePostCount - 1].offline = false
            }
        });
      }
    },
    initNotificationsBanner() {
      let neverShowNotificationsBanner = this.$q.localStorage.getItem('neverShowNotificationsBanner')

      console.log('neverShowNotificationsBanner', neverShowNotificationsBanner)

      if (!neverShowNotificationsBanner) {
        this.showNotificationsBanner = true   
      }
    },
    enableNotifications() {
      if (this.pushNotificationsSupported) {
        Notification.requestPermission(result => {
          this.neverShowNotificationsBanner()
          if (result == 'granted') {
            // this.displayGrantedNotification()
            this.checkForExistingPushSubscription()
          }
        })
      }
    },
    checkForExistingPushSubscription() {
      let reg
      if (this.serviceWorkerSupported && this.pushNotificationsSupported) {
        navigator.serviceWorker.ready.then(swreg => {
          reg = swreg
          return swreg.pushManager.getSubscription()
        }).then(sub => {
          if (!sub) {
            this.createPushSubscription(reg)
          }
        })
      }
    },
    createPushSubscription(reg) {
      let vapidPublicKey = 'BG4Dtbzl48JZsd5yJIXNufu_k98856Y1GeNNogj5JSSee452e_O7EDs9XfOtxvKvwOWm6GK5Zz9K5D98cJCh4oA'
      // reg.pushManager.subscribe()
      reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: vapidPublicKey
      }).then(newSub => {
        let newSubData = newSub.toJSON(),
            newSubDataQS = qs.stringify(newSubData)
        console.log('sending request')
        return this.$axios.post(`${ process.env.API }/createSubscription?${ newSubDataQS }`)
      }).then(response => {
        this.displayGrantedNotification()
      }).catch(err => {
        console.log('err', err);
      })
    },
    neverShowNotificationsBanner() {
      this.showNotificationsBanner = false
      this.$q.localStorage.set('neverShowNotificationsBanner', true)
    },
    displayGrantedNotification() {
      // new Notification('You have subscribed to notifications',
      // {
      //   body: 'Thanks for subcribing',
      //   icon: 'public/icons/icon-128x128.png',
      //   image: 'public/icons/icon-128x128.png',
      //   badge: 'public/icons/icon-128x128.png',
      //   dir: 'rtl',
      //   lang: 'en',
      //   vibrate: [100, 50, 200],
      //   tag: 'confirm-notification',
      //   renotify: true,
      // })

      if (this.serviceWorkerSupported && this.pushNotificationsSupported) {
        navigator.serviceWorker.ready.then(swreg => {
          swreg.showNotification('You have subscribed to notifications',
          {
            body: 'Thanks for subcribing',
            icon: 'public/icons/icon-128x128.png',
            image: 'public/icons/icon-128x128.png',
            badge: 'public/icons/icon-128x128.png',
            dir: 'rtl',
            lang: 'en',
            vibrate: [100, 50, 200],
            tag: 'confirm-notification',
            renotify: true,
            actions: [
              {
                action: 'hello',
                title: 'Hello',
                icon: 'public/icons/icon-128x128.png',
              },
              {
                action: 'goodbye',
                title: 'Goodbye',
                icon: 'public/icons/icon-128x128.png',
              }
            ]
          })
        })
      }
    }
  },
  activated() { // when the user visits the page
    this.getPosts()
  },
  created() {
    this.listenForOfflinePostUploaded()
    this.initNotificationsBanner()
  },
  filters: {
    niceDate(value) {
      return date.formatDate(value, 'MMMM D h:mmA')
    }
  }
}
</script>

<style lang="sass">
  .card-post
    .badge-offline
      border-top-left-radius: 0 !important
    .q-img
      min-height: 200px
</style>
