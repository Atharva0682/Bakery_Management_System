require('dotenv').config({path:require('node:path').join(__dirname,'..','.env')});
const {Pool}=require('pg');
const pool=new Pool(process.env.DATABASE_URL ? {connectionString:process.env.DATABASE_URL,connectionTimeoutMillis:3000} : {host:process.env.DB_HOST || 'localhost',port:Number(process.env.DB_PORT || 5432),database:process.env.DB_NAME || 'bakery_db',user:process.env.DB_USER || 'postgres',password:process.env.DB_PASSWORD,connectionTimeoutMillis:3000});
pool.query('SELECT current_database() AS database').then(result=>console.log('PostgreSQL read-only connection verified:',result.rows[0].database)).catch(error=>{console.log('PostgreSQL connection not verified:',error.code || error.message);process.exitCode=1}).finally(()=>pool.end());
