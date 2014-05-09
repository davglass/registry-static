static npm registry
-------------------

This module follows the `skimdb` from npm and creates a flat file copy of the
registry on your local machine. This can then be served up behind `nginx` to
give you a local, read-only copy of the npm registry.


usage
-----

    registry-static -d my.registry.com -o /var/www/registry

This is the most common use, this will start following the registry
and make copies of the modules and their tarballs into `/var/www/registry`.
When it does, it will replace the `tarball` key in the `package.json`
with the url provided with `-d` (so the downloads resolve locally).

nginx configuration
-------------------

    server {
        listen       9000;
        server_name  localhost;
        charset utf-8;
        location / {
            root   /var/www/registry/;
            index  index.json;
        }
        error_page  404              /404.json;
    }
