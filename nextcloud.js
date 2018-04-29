module.exports = function(RED) {
    let dav = require('dav')
    let webdav = require('webdav')
    const fs = require('fs')

    function NextcloudConfigNode(n) {
        RED.nodes.createNode(this, n)
        this.address = n.address
    }
    RED.nodes.registerType('nextcloud-credentials', NextcloudConfigNode, {
        credentials: {
            user: {type: 'text'},
            pass: {type: 'password'}
        }
    })

    function NextcloudCalDav(n) {
        RED.nodes.createNode(this, n)
        this.server = RED.nodes.getNode(n.server)
        this.calendar = n.calendar
        let node = this

        node.on('input', function(msg) {
            const xhr = new dav.transport.Basic (
                new dav.Credentials({
                    username: node.server.credentials.user,
                    password: node.server.credentials.pass
                })
            )
            // Server + Basepath
            let calDavUri = node.server.address + '/remote.php/dav/calendars/'
            // User
            calDavUri += node.server.credentials.user + '/'
            dav.createAccount({ server: calDavUri, xhr: xhr })
                .then(function(account) {
                    if (!account.calendars) {
                        node.error('Nextcloud:CalDAV -> no calendars found.')
                        return
                    }
                    // account instanceof dav.Account
                    account.calendars.forEach(function(calendar) {
                        // Wenn Kalender gesetzt ist, dann nur diesen abrufen
                        let c = msg.calendar || node.calendar
                        if (!c || !c.length || (c && c.length && c === calendar.displayName)) {
                            dav.listCalendarObjects(calendar, { xhr: xhr })
                                .then(function(calendarEntries) {
                                    let icsList = {'payload': {'name': calendar.displayName, 'data': []}}
                                    calendarEntries.forEach(function(calendarEntry) {
                                        const keyValue = calendarEntry.calendarData.split('\n')
                                        let icsJson = {}
                                        for (let x = 0; x < keyValue.length; x++) {
                                            const temp = keyValue[x].split(':')
                                            icsJson[temp[0]] = temp[1]
                                        }
                                        icsList.payload.data.push(icsJson)
                                    })
                                    node.send(icsList)
                                }, function(){
                                    node.error('Nextcloud:CalDAV -> get ics went wrong.')
                                })
                        }
                    })
                }, function(){
                    node.error('Nextcloud:CalDAV -> get calendars went wrong.')
                })
        })
    }
    RED.nodes.registerType('nextcloud-caldav', NextcloudCalDav)


    function NextcloudCardDav(n) {
        RED.nodes.createNode(this, n)
        this.server = RED.nodes.getNode(n.server)
        this.addressBook = n.addressBook
        let node = this

        node.on('input', function(msg) {
            const xhr = new dav.transport.Basic (
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
                .then(function(account) {
                    if (!account.addressBooks) {
                        node.error('Nextcloud:CardDAV -> no addressbooks found.')
                        return
                    }
                    // account instanceof dav.Account
                    account.addressBooks.forEach(function(addressBook) {
                        // Wenn Adressbuch gesetzt ist, dann nur diesen abrufen
                        let c = msg.addressBook || node.addressBook
                        if (!c || !c.length || (c && c.length && c === addressBook.displayName)) {
                            dav.listVCards(addressBook, { xhr: xhr })
                                .then(function(addressBookEntries) {
                                    let vcfList = {'payload': {'name': addressBook.displayName, 'data': []}}
                                    addressBookEntries.forEach(function(addressBookEntry) {
                                        const keyValue = addressBookEntry.addressData.split('\n')
                                        let vcfJson = {}
                                        for (let x = 0; x < keyValue.length; x++) {
                                            const temp = keyValue[x].split(':')
                                            vcfJson[temp[0]] = temp[1]
                                        }
                                        vcfList.payload.data.push(vcfJson)
                                    })
                                    node.send(vcfList)
                                }, function(){
                                    node.error('Nextcloud:CardDAV -> get cards went wrong.')
                                })
                        }
                    })
                }, function(){
                    node.error('Nextcloud:CardDAV -> get addressBooks went wrong.')
                })

        })
    }
    RED.nodes.registerType('nextcloud-carddav', NextcloudCardDav)


    function NextcloudWebDavList(n) {
        RED.nodes.createNode(this, n)
        this.server = RED.nodes.getNode(n.server)
        this.directory = n.directory
        let node = this

        node.on('input', function(msg) {
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
                    node.send({'payload': contents})
                }, function (error) {
                    node.error('Nextcloud:WebDAV -> get directory content went wrong.' + JSON.stringify(error))
                })
        })
    }
    RED.nodes.registerType('nextcloud-webdav-list', NextcloudWebDavList)


    function NextcloudWebDavOut(n) {
        RED.nodes.createNode(this, n)
        this.server = RED.nodes.getNode(n.server)
        this.filename = n.filename
        let node = this

        node.on('input', function(msg) {
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
                    node.send({'payload': contents})
                }, function (error) {
                    node.error('Nextcloud:WebDAV -> get file went wrong.' + JSON.stringify(error))
                })
        })
    }
    RED.nodes.registerType('nextcloud-webdav-out', NextcloudWebDavOut)


    function NextcloudWebDavIn(n) {
        RED.nodes.createNode(this, n)
        this.server = RED.nodes.getNode(n.server)
        this.directory = n.directory
        this.filename = n.filename
        let node = this

        node.on('input', function(msg) {
            // Read upload file
            let filename = node.filename
            if (msg.filename) {
                filename = msg.filename
            }
            const name = filename.substr((filename.lastIndexOf('/') + 1), filename.length)
            const file = fs.readFileSync(filename);
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
                .then(function(contents) {
                    console.log(contents)
                    node.send({'payload': JSON.parse(contents)})
                }, function() {
                    node.error('Nextcloud:WebDAV -> send file went wrong.')
                })
        })
    }
    RED.nodes.registerType('nextcloud-webdav-in', NextcloudWebDavIn)
}
