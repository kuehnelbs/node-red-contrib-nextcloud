# node-red-contrib-nextcloud
Collection of node-red nodes to download Calendars (CalDAV) and Contacts
(CardDAV) and up- / download / list files (WebDAV) from / to [nextcloud](https://nextcloud.com/)

Detailed information can be found in the build in info of each node

## Installation
npm install node-red-contrib-nextcloud

### CalDAV
- based on [dav](https://github.com/lambdabaa/dav) package using CalDAV protocol
- reads all calendars and sends a message for each calendar
- reads a specified calandar if set in node properties or incoming message

### CardDAV
- based on [dav](https://github.com/lambdabaa/dav) package using CalDAV protocol
- reads all addressbooks and sends a message for each adressbook
- reads a specified addressbook if set in node properties or incoming message

### WebDAV
- based on [webdav](https://github.com/perry-mitchell/webdav-client) package using WebDAV protocol

##### Read content of a server directory
- reads content of the users root directory if no folder is specified
- reads content of a given directory specified in node properties or incoming message

##### Upload a file to a server directory
- uploads a file to nextcloud server
- absolute path of upload file can be set in node properties or incoming message
- server directory can be set in node properties or incoming message

##### Download a file from a server directory
- downloads a file from nextcloud server
- file on server can be set in node properties or incoming message
- sends file as binary buffer to the output. File can be stored using file node
