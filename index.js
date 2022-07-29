var Imap = require('node-imap');
const fs = require('fs');
const date = require('date-and-time');
const dotenv = require('dotenv');

dotenv.config();

//Cargar datos de conexión de gmail
const imap = new Imap({
  user: process.env.MAIL_USER,
  password: process.env.MAIL_PASS,
  host: process.env.MAIL_HOST,
  port: process.env.MAIL_PORT,
  tls: true,
  tlsOptions: {
    rejectUnauthorized: false
  }
});
let mails = []; //Array para la información de los correos
 
function openInbox(cb) {
  imap.openBox('INBOX', true, cb);
}

imap.once('ready', function() {
    openInbox(function(err, box) {
        if (err) throw err;
  
        let searchParams = [];
        let id = fs.readFileSync('UID.txt', 'utf8');
      
        if (id) {
            id = Number(id) + 1;
            searchParams.push(['UID', id + ':*']);
        } else {
            const initialDate = date.format(new Date(), 'MMM D, YYYY');
            searchParams.push(['ON', initialDate]);
        }
  
        imap.search(searchParams, function(err, results) {
            if (err) {
                throw err;
            }

            if (results.length > 0) {
                //Ordenar los ids de los mails descendentemente
                results.sort(function(a, b) {
                    return a - b;
                });

                //Si el id mayor es menor que el id registrado, se termina el programa
                if (results[0] < id) {
                    process.exit();
                }

                //Recuperar los mails
                let f = imap.fetch(results, {
                    bodies: ['HEADER.FIELDS (FROM TO SUBJECT DATE)', 'TEXT'],
                    struct: true
                });

                //Procesar cada mail
                f.on('message', function(msg, seqno) {
                    let auxHeader = '';
                    let auxBody = '';
                    let parsedMsg = {
                            header: '',
                            body: ''
                        };

                    msg.on('body', function(stream, info) {
                        if (info.which === 'TEXT') {
                            stream.on('data', function(chunk) {
                                auxBody += chunk.toString('utf8');
                            })
                            stream.once('end', function() {
                                parsedMsg.body = auxBody;
                            })
                        } else {
                            stream.on('data', function(chunk) {
                                auxHeader += chunk.toString('utf8');
                            })
                            stream.once('end', function() {
                                parsedMsg.header = Imap.parseHeader(auxHeader);
                            })
                        }
                    })

                    msg.once('attributes', function(attrs) {
                        parsedMsg.attrs = attrs;
                    });

                    msg.once('end', function() {
                        mails.push({
                            id : parsedMsg.attrs.uid,
                            message : parsedMsg
                        });
                    })

                });

                //Error al procesar mail
                f.once('error', function(err) {
                    console.log('Fetch error: ' + err);
                });

                f.once('end', function() {
                    imap.end();
                });

            }else{
                imap.end();
            }
        })
    });
});

//Error en conexion con el servidor de correo
imap.once('error', function(err) {
    console.log("Mail server error " + err);
});
   
imap.once('end', async function() {
    for (let x in mails) {

        console.log('Subject: ' + mails[x].message.header.subject[0]);

        console.log('Body: ' + mails[x].message.body);

        //Guardar el id del mail
        fs.writeFileSync('UID.txt', "" + mails[x].message.attrs.uid);
    }
});

imap.connect();