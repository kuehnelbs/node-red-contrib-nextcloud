module.exports = function (RED) {
  const dav = require('dav')
  const webdav = require('webdav')
  const fs = require('fs')
  const IcalExpander = require('ical-expander')
  const moment = require('moment')

  function NextcloudConfigNode (config) {
    RED.nodes.createNode(this, config)
    this.address = config.address
  }
  RED.nodes.registerType('nextcloud-credentials', NextcloudConfigNode, {
    credentials: {
      user: { type: 'text' },
      pass: { type: 'password' }
    }
  })

  function NextcloudCalDav (config) {
    RED.nodes.createNode(this, config)
    this.server = RED.nodes.getNode(config.server)
    this.calendar = config.calendar
    this.pastWeeks = config.pastWeeks || 0
    this.futureWeeks = config.futureWeeks || 4
    const node = this

    node.on('input', (msg) => {
      let startDate = moment().startOf('day').subtract(this.pastWeeks, 'weeks')
      let endDate = moment().endOf('day').add(this.futureWeeks, 'weeks')
      const filters = [{
        type: 'comp-filter',
        attrs: { name: 'VCALENDAR' },
        children: [{
          type: 'comp-filter',
          attrs: { name: 'VEVENT' },
          children: [{
            type: 'time-range',
            attrs: {
              start: startDate.format('YYYYMMDD[T]HHmmss[Z]'),
              end: endDate.format('YYYYMMDD[T]HHmmss[Z]')
            }
          }]
        }]
      }]
      // dav.debug.enabled = true;
      const xhr = new dav.transport.Basic(
        new dav.Credentials({
          username: node.server.credentials.user,
          password: node.server.credentials.pass
        })
      )
      // Server + Basepath
      let calDavUri = node.server.address + '/remote.php/dav/calendars/'
      // User
      calDavUri += node.server.credentials.user + '/'
      dav.createAccount({ server: calDavUri, xhr: xhr, loadCollections: true, loadObjects: true })
        .then(function (account) {
          if (!account.calendars) {
            node.error('Nextcloud:CalDAV -> no calendars found.')
            return
          }
          // account instanceof dav.Account
          account.calendars.forEach(function (calendar) {
            // Wenn Kalender gesetzt ist, dann nur diesen abrufen
            let calName = msg.calendar || node.calendar
            if (!calName || !calName.length || (calName && calName.length && calName === calendar.displayName)) {
              dav.listCalendarObjects(calendar, { xhr: xhr, filters: filters })
                .then(function (calendarEntries) {
                  let msg = { 'payload': { 'name': calendar.displayName, 'data': [] } }
                  calendarEntries.forEach(function (calendarEntry) {
                    try {
                      const ics = calendarEntry.calendarData
                      const icalExpander = new IcalExpander({ ics, maxIterations: 100 })
                      const events = icalExpander.between(startDate.toDate(), endDate.toDate())
                      msg.payload.data = msg.payload.data.concat(convertEvents(events))
                    } catch (error) {
                      node.error('Error parsing calendar data: ' + error)
                    }
                  })
                  node.send(msg)
                }, function () {
                  node.error('Nextcloud:CalDAV -> get ics went wrong.')
                })
            }
          })
        }, function () {
          node.error('Nextcloud:CalDAV -> get calendars went wrong.')
        })
    })

    function convertEvents (events) {
      const mappedEvents = events.events.map(_convertEvent)
      const mappedOccurrences = events.occurrences.map(_convertEvent)
      return [].concat(mappedEvents, mappedOccurrences)
    }

    function _convertEvent (e) {
      if (e) {
        let startDate = e.startDate.toString()
        let endDate = e.endDate.toString()

        if (e.item) {
          e = e.item
        }
        if (e.duration.wrappedJSObject) {
          delete e.duration.wrappedJSObject
        }

        return {
          startDate: startDate,
          endDate: endDate,
          summary: e.summary || '',
          description: e.description || '',
          attendees: e.attendees,
          duration: e.duration.toICALString(),
          durationSeconds: e.duration.toSeconds(),
          location: e.location || '',
          organizer: e.organizer || '',
          uid: e.uid || '',
          isRecurring: false,
          allDay: (e.duration.toSeconds() === 86400)
        }
      }
    }
  }
  RED.nodes.registerType('nextcloud-caldav', NextcloudCalDav)

  function NextcloudCardDav (config) {
    RED.nodes.createNode(this, config)
    this.server = RED.nodes.getNode(config.server)
    this.addressBook = config.addressBook
    const node = this

    node.on('input', (msg) => {
      const xhr = new dav.transport.Basic(
        new dav.Credentials({
          username: node.server.credentials.user,
          password: node.server.credentials.pass
        })
      )

      // Server + Basepath
      let cardDavUri = node.server.address + '/remote.php/dav/addressbooks/users/'
      // User
      cardDavUri += node.server.credentials.user + '/'
      // ToDo Filter ?
      dav.createAccount({ server: cardDavUri, xhr: xhr, accountType: 'carddav' })
        .then(function (account) {
          if (!account.addressBooks) {
            node.error('Nextcloud:CardDAV -> no addressbooks found.')
            return
          }
          // account instanceof dav.Account
          account.addressBooks.forEach(function (addressBook) {
            // Wenn Adressbuch gesetzt ist, dann nur diesen abrufen
            let c = msg.addressBook || node.addressBook
            if (!c || !c.length || (c && c.length && c === addressBook.displayName)) {
              dav.listVCards(addressBook, { xhr: xhr })
                .then(function (addressBookEntries) {
                  let vcfList = { 'payload': { 'name': addressBook.displayName, 'data': [] } }
                  addressBookEntries.forEach(function (addressBookEntry) {
                    const keyValue = addressBookEntry.addressData.split('\n')
                    let vcfJson = {}
                    for (let x = 0; x < keyValue.length; x++) {
                      const temp = keyValue[x].split(':')
                      vcfJson[temp[0]] = temp[1]
                    }
                    vcfList.payload.data.push(vcfJson)
                  })
                  node.send(vcfList)
                }, function () {
                  node.error('Nextcloud:CardDAV -> get cards went wrong.')
                })
            }
          })
        }, function () {
          node.error('Nextcloud:CardDAV -> get addressBooks went wrong.')
        })
    })
  }
  RED.nodes.registerType('nextcloud-carddav', NextcloudCardDav)

  function NextcloudWebDavList (config) {
    RED.nodes.createNode(this, config)
    this.server = RED.nodes.getNode(config.server)
    this.directory = config.directory
    const node = this

    node.on('input', (msg) => {
      const webDavUri = node.server.address + '/remote.php/webdav/'
      const client = webdav(webDavUri, node.server.credentials.user, node.server.credentials.pass)
      let directory = ''
      if (msg.directory) {
        directory = '/' + msg.directory
      } else if (node.directory && node.directory.length) {
        directory = '/' + node.directory
      }
      directory = directory.replace('//', '/')

      client.getDirectoryContents(directory)
        .then(function (contents) {
          node.send({ 'payload': contents })
        }, function (error) {
          node.error('Nextcloud:WebDAV -> get directory content went wrong.' + JSON.stringify(error))
        })
    })
  }
  RED.nodes.registerType('nextcloud-webdav-list', NextcloudWebDavList)

  function NextcloudWebDavOut (config) {
    RED.nodes.createNode(this, config)
    this.server = RED.nodes.getNode(config.server)
    this.filename = config.filename
    const node = this

    node.on('input', (msg) => {
      const webDavUri = node.server.address + '/remote.php/webdav/'
      const client = webdav(webDavUri, node.server.credentials.user, node.server.credentials.pass)
      let filename = ''
      if (msg.filename) {
        filename = '/' + msg.filename
      } else if (node.filename && node.filename.length) {
        filename = '/' + node.filename
      } else {
        node.error('Nextcloud:WebDAV -> no filename specified.')
        return
      }
      filename = filename.replace('//', '/')
      node.warn(filename)
      client.getFileContents(filename)
        .then(function (contents) {
          node.send({ 'payload': contents })
        }, function (error) {
          node.error('Nextcloud:WebDAV -> get file went wrong.' + JSON.stringify(error))
        })
    })
  }
  RED.nodes.registerType('nextcloud-webdav-out', NextcloudWebDavOut)

  function NextcloudWebDavIn (config) {
    RED.nodes.createNode(this, config)
    this.server = RED.nodes.getNode(config.server)
    this.directory = config.directory
    this.filename = config.filename
    const node = this

    node.on('input', (msg) => {
      // Read upload file
      let filename = node.filename
      if (msg.filename) {
        filename = msg.filename
      }
      const name = filename.substr((filename.lastIndexOf('/') + 1), filename.length)
      const file = fs.readFileSync(filename)
      // Set upload directory
      let directory = '/'
      if (msg.directory) {
        directory += msg.directory + '/'
      } else if (node.directory && node.directory.length) {
        directory += node.directory + '/'
      }
      directory = directory.replace('//', '/')

      const webDavUri = node.server.address + '/remote.php/webdav/'
      const client = webdav(webDavUri, node.server.credentials.user, node.server.credentials.pass)

      client.putFileContents(directory + name, file, { format: 'binary' })
        .then(function (contents) {
          console.log(contents)
          node.send({ 'payload': JSON.parse(contents) })
        }, function () {
          node.error('Nextcloud:WebDAV -> send file went wrong.')
        })
    })
  }
  RED.nodes.registerType('nextcloud-webdav-in', NextcloudWebDavIn)
}
