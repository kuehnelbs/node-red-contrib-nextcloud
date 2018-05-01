# node-red-contrib-nextcloud changelog

## 0.1.1
_2018-05-xx_ (work in progress)
* added checkbox to accept self signed server certificates to credentials
* added support for self signed certificates to WebDAV nodes (needs [webdav](https://github.com/perry-mitchell/webdav-client) package to be updated to 1.5.3 or newer)
* removed debug output in node WebDAV list

## 0.1.0
_2018-04-30_
* addad missing option to set directory in incoming message for WebDAV list
* published to npm

## 0.0.1
_2018-04-29_

 * Initial version
   * CalDAV Node (simple download of calendar entries (ics), no sync, no upload)
   * CardDAV Node (simple download of addressbook entries (vcf), no sync, no upload)
   * WebDAV Nodes
     * List directory entries
     * upload file to nextcloud server
     * download file to nextcloud server

