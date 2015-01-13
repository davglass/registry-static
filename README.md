static npm registry mirror
--------------------------

This module follows the `skimdb` from npm and creates a flat file copy of the
registry on your local machine. This can then be served up behind `nginx` to
give you a local, read-only mirror of the npm registry. It's not a private registry
nor does it attempt to be one. It's designed to allow you to use the registry
in-network to speed up your local development.

usage
-----

    registry-static -d my.registry.com -o /var/www/registry

This is the most common use, this will start following the registry
and make copies of the modules and their tarballs into `/var/www/registry`.
When it does, it will replace the `tarball` key in the `package.json`
with the url provided with `-d` (so the downloads resolve locally).

This module also uses the sequence file, so you can kill it and it should
restart from where it left off.

_WARNING: This may take quite a while to complete and a large amount of disk space (more than 117GB at last check)_

directory structure
-------------------

When it pulls the `package.json` for a module, it will create a directory structure similar to this:

    ./davargs
    ├── -
    │   ├── davargs-0.0.1.tgz
    │   └── davargs-0.0.2.tgz
    ├── 0.0.1
    │   └── index.json
    ├── 0.0.2
    │   └── index.json
    ├── index.json
    └── latest
        └── index.json

This allows for the following url, styles to work:

    my.registry.com/davargs
    my.registry.com/davargs/0.0.1
    my.registry.com/davargs/0.0.2
    my.registry.com/davargs/latest



nginx configuration
-------------------

Since we are writing a bunch of `index.json` files, you need to setup `nginx` to front the filesytem to resolve things like:

    myregistry.com/foo
                    /index.json

Here is the simple `nginx.config` that I use on my local mirror.

    server {
        listen       80;
        server_name  localhost;
        charset utf-8;
        root   /Users/davglass/registry/;
        index  index.json;

        #cache the crap out of the tarballs
        location ~* ^.+\.(?:tgz)$ {
            expires 30d;
            tcp_nodelay off;
            open_file_cache max=3000 inactive=120s;
            open_file_cache_valid 45s;
            open_file_cache_min_uses 2;
            open_file_cache_errors off;
        }

        #don't cache the main index
        location /index.json {
            expires -1;
        }

        #cache all json by modified time
        location / {
            expires modified +15m;
            try_files $uri $uri/index.json $uri.json =404;
        }

        error_page  404              /404.json;
    }



_The `try_files` here with `$uri` are to keep nginx from doing a 302 redirect without the trailing `/`_

logic
-----

First, no files are ever deleted. The reference to the tarball may be removed from the local `package.json` but
the tarball itself is not removed. This is for things like `npm shrinkwrap`.

Each download is verified against the `shasum` in the package.json. If the verification fails, the file is retried
up to 4 times. If it fails all of those, it is skipped and not stored locally.

Each `change` request will process the entire module, not just the change alone. This is to make sure that tags
and new versions are all in sync.

automating it
-------------

The main process always writes a `pid` file: `$TMPDIR/registry-static.pid`
If you use the `--restart` option, it will send a `SIGHUP` to the registered process found in the `pid` file. 
It will then restart the child process.

This way you can add a crontab entry to force a restart so you don't have to monitor the process all the time.

hooks
-----

If you provide `--hooks <path>`, the module at `path` will be `required`. It is expected to export an object
whose properties are hook functions. A hook function has the following signature:

```javascript
function(data, callback){ /* ... */ }
```

Here, `data` is a blob of data corresponding to the current state. Usually it's a set of useful metadata about
the package currently being processed.

The callback's signature is:

```javascript
function(error, shouldSave){ /* ... */ }
```

Where `shouldSave` is a boolean stating whether or not to actually perform the action that happens right
after the hook (usually writing something to disk). In most cases, you'll want to call the callback with
`callback(null, true)`. To prevent the action from happening, you can do `callback(null, false)`.

Please don't throw any errors inside a hook function. If an error occurs, pass it along as a first parameter to
the `callback`.

Here are the currently provided hooks:

* **`globalIndexJson`**: Called before writing an update to the top-level `index.json`.
* **`indexJson`**: Called before writing a package's main `index.json`.
* **`versionJson`**: Called before writing the `index.json` for a particular package version.
* **`tarball`**: Called before downloading/verifying/writing a package tarball.
* **`afterTarball`**: Called after downloading/verifying/writing a package tarball. Note that the second callback parameter is ignored for this one.

For example, if you want to prevent writing any tarballs, to have a metadata-only mirror (like skimdb), you could do something like this:

```javascript
// hooks.js
exports.tarball = function(data, callback) {
    // Because this doesn't explicitly provide a truthy second arg,
    // it will not download and save the tarball.
    callback();
}
```

And then, if it's in your current directory, you can do something like:

```bash
registry-static -d registry.npmjs.org --hooks ./hooks.js
```

logging
-------

Supports `--log <path>` to log all output to a specific file.

When doing this, you may want to rotate your logs. You can do this by sending the main 
process a `SIGPIPE` signal. This will free up the file descriptor and then reattach it to the file.

If you are using logrotate.d, here is a sample command and config:

`registry-static -d my.registry.com -o /var/www/ --tmp /tmp/ --log /var/log/registry-static/output.log`


    /etc/logrotate.d/registry-static:

    /var/log/registry-static/*.log {
            daily
            missingok
            rotate 52
            compress
            delaycompress
            notifempty
            sharedscripts
            postrotate
                    [ -f /tmp/registry-static.pid ] && kill -PIPE `cat /tmp/registry-static.pid`
            endscript
    }


what it doesn't do
------------------

Smart routes like `/-/all` or `/-/short`

These routes require processing of the files. You "could" technically do it with a cache and using the `fs` module
to walk the tree and build those routes.

build
-----

[![Build Status](https://travis-ci.org/davglass/registry-static.svg?branch=master)](https://travis-ci.org/davglass/registry-static)
