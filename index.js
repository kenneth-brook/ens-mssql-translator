const sql = require('mssql');
const { Pool } = require('pg');
const dotenv = require('dotenv');
dotenv.config();

// AWS Lambda entry point
module.exports.handler = async (event, context) => {
    

    let data = event;

    console.log('Incoming Event parsed to data:', data);


    try {
        // Parse JSON object from the event
        const dbName = `client-${data.key}`;
        const dbLoc = data.trans_db_loc;

        console.log('DB Name', dbName);

        // Configure MSSQL connection
        const mssqlConfig = {
            user: data.raw_user,
            password: data.raw_pass,
            server: data.raw_server,
            database: data.raw_table,
        };

        // Configure PostgreSQL connection
        const pgsqlConfig = {
            user: process.env.DB_USER,
            host: dbLoc,
            database: 'postgres',
            password: "ZCK,tCI8lv4o",
            port: process.env.DB_PORT,
            max: 20,
            ssl: true,
        };

        // Connect to MSSQL
        await sql.connect(mssqlConfig);

        // Get data from MSSQL
        const mssql = await sql.query(`SELECT * FROM ${data.raw_table_name}`);

        console.log('mssql', mssql);

        // Create a PostgreSQL pool
        const pgPool = new Pool(pgsqlConfig);

    // Check if the table exists in PostgreSQL, create if not
    await pgPool.query(`CREATE TABLE IF NOT EXISTS client_data_${new Date().getFullYear()} (
        active VARCHAR(3),
        agency_type VARCHAR(64),
        battalion VARCHAR(64),
        db_city VARCHAR(64),
        creation VARCHAR(64),
        crossstreets VARCHAR(64),
        entered_queue VARCHAR(64),
        db_id VARCHAR(64),
        jurisdiction VARCHAR(64),
        latitude VARCHAR(64),
        location VARCHAR(64),
        longitude VARCHAR(64),
        master_incident_id VARCHAR(64),
        premise VARCHAR(64),
        priority VARCHAR(64),
        sequencenumber VARCHAR(64),
        stacked VARCHAR(64),
        db_state VARCHAR(64),
        status VARCHAR(64),
        statusdatetime VARCHAR(64),
        type VARCHAR(64),
        type_description VARCHAR(64),
        zone VARCHAR(64)
    )`);

    // Set all rows' 'active' column to 'no'
    //await pgPool.query(`UPDATE client_data_${new Date().getFullYear()} SET active = 'no'`);

    const year = new Date().getFullYear();

    await pgPool.query(`UPDATE client_data_${year} SET active = 'no'`);

    for (const row of mssql.recordset) {
      
  
      // Check if the row exists in PostgreSQL
      const existingRow = await pgPool.query(
          `SELECT * FROM client_data_${year} WHERE db_id = $1`,
          [row[data.db_id]]
      );
  
      if (existingRow.rows.length > 0) {
          const existingData = existingRow.rows[0];
  
          // Check for changes in data
          const dataChanged = Object.keys(row).some(key => row[key] !== existingData[key]);
  
          if (dataChanged) {
              // Data has changed, update all columns and set 'active' to 'yes'
              const updateQuery = `
                  UPDATE client_data_${year} 
                  SET 
                      active = 'yes',
                      agency_type = $2,
                      battalion = $3,
                      db_city = $4,
                      creation = $5,
                      crossstreets = $6,
                      entered_queue = $7,
                      db_id = $8,
                      jurisdiction = $9,
                      latitude = $10,
                      location = $11,
                      longitude = $12,
                      master_incident_id = $13,
                      premise = $14,
                      priority = $15,
                      sequencenumber = $16,
                      stacked = $17,
                      db_state = $18,
                      status = $19,
                      statusdatetime = $20,
                      type = $21,
                      type_description = $22,
                      zone = $23
                  WHERE db_id = $1
              `;

              console.log(``)
  
              const updateValues = [
                row[data.db_id], row[data.agency_type], row[data.battalion], row[data.db_city],
                row[data.creation], row[data.crossstreets], row[data.entered_queue],
                row[data.db_id], row[data.jurisdiction], row[data.latitude], row[data.location],
                row[data.longitude], row[data.master_incident_id], row[data.premise],
                row[data.priority], row[data.sequencenumber], row[data.stacked],
                row[data.db_state], row[data.status], row[data.statusdatetime],
                row[data.type], row[data.type_description], row[data.zone]
              ];
  
              await pgPool.query(updateQuery, updateValues);
          } else {
              // Data hasn't changed, just set 'active' to 'yes'
              await pgPool.query(
                  `UPDATE client_data_${year} SET active = 'yes' WHERE db_id = $1`,
                  [row[data.db_id]]
              );
          }
    } else {
        // Row doesn't exist, insert new row
        const insertQuery = `
            INSERT INTO client_data_${year} (
                active, agency_type, battalion, db_city, creation, crossstreets, entered_queue,
                db_id, jurisdiction, latitude, location, longitude, master_incident_id, premise,
                priority, sequencenumber, stacked, db_state, status, statusdatetime, type,
                type_description, zone
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23)
        `;

        const insertValues = [
          'yes', row[data.agency_type], row[data.battalion], row[data.db_city],
          row[data.creation], row[data.crossstreets], row[data.entered_queue],
          row[data.db_id], row[data.jurisdiction], row[data.latitude], row[data.location],
          row[data.longitude], row[data.master_incident_id], row[data.premise],
          row[data.priority], row[data.sequencenumber], row[data.stacked],
          row[data.db_state], row[data.status], row[data.statusdatetime],
          row[data.type], row[data.type_description], row[data.zone]
      ];

        await pgPool.query(insertQuery, insertValues);
    }
}


    // Close connections
    await sql.close();
    await pgPool.end();

    return {
        statusCode: 200,
        body: JSON.stringify({ message: 'Successfully processed data' }),
    };
} catch (error) {
    console.error('Error:', error);
    return {
        statusCode: 500,
        body: JSON.stringify({ message: `Internal Server Error ***** The Data ${data}` }),
    };
}
};