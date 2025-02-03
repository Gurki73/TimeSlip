const fs = require('fs');

// Function to read and transpose CSV
function transposeCSV(filePath, outputFilePath) {
  fs.readFile(filePath, 'utf8', (err, data) => {
    if (err) {
      console.error('Error reading the file:', err);
      return;
    }

    // Split data into rows and then columns
    const rows = data.split('\n').map(row => row.split(','));

    // Transpose the data (swap rows and columns)
    const transposed = rows[0].map((_, colIndex) => rows.map(row => row[colIndex]));

    // Convert transposed data back to CSV format
    const transposedCsv = transposed.map(row => row.join(',')).join('\n');

    // Write the transposed data to a new CSV file
    fs.writeFile(outputFilePath, transposedCsv, (err) => {
      if (err) {
        console.error('Error saving the transposed file:', err);
      } else {
        console.log('Transposed CSV saved to', outputFilePath);
      }
    });
  });
}

// Usage: 
// Provide the input CSV file and the output CSV file where the transposed version will be saved
transposeCSV('yourfile.csv', 'transposed_file.csv');
