const rules = {
    w0: {
      id: "w0",
      label: "jeden 🕒",
      description: "Occurs every time frame",
      grammar: {
        singular: {
          nominative: "die Aufgabe",
          accusative: "die Aufgabe",
          dative: "der Aufgabe"
        },
        plural: {
          nominative: "die Aufgaben",
          accusative: "die Aufgaben",
          dative: "den Aufgaben"
        }
      },
      upperLimit: Infinity,
      bottomLimit: 0,
      relatedTo: "timeFrame", // Or "role"
      relativeTo: true, // Whether it's a ratio or absolute
      check: (param) => param >= 0 && param <= Infinity,
      toHumanReadable: () => "Jeder Aufgabe in jedem Zeitrahmen.",
      toMachineReadable: () => ({ min: 0, max: Infinity, type: "timeFrame" })
    },
    w1: {
      id: "w1",
      label: "niemals 🕒",
      description: "Never occurs in the time frame",
      grammar: { /* same structure as above */ },
      upperLimit: 0,
      bottomLimit: Infinity,
      relatedTo: "timeFrame",
      relativeTo: false,
      check: (param) => param === 0,
      toHumanReadable: () => "Keine Aufgabe in keinem Zeitrahmen.",
      toMachineReadable: () => ({ min: 0, max: 0, type: "timeFrame" })
    },
    w2: {
      id: "w2",
      label: "pro 🕒",
      description: "Occurs per time frame",
      grammar: { /* same structure as above */ },
      upperLimit: Infinity,
      bottomLimit: 0,
      relatedTo: "timeFrame",
      relativeTo: true,
      check: (param) => param > 0,
      toHumanReadable: (param) => `Pro Zeitrahmen ${param} Aufgaben.`,
      toMachineReadable: (param) => ({ min: param, max: param, type: "timeFrame" })
    }
  };

// Numbers:
//   Type                           |   human read     | machine readable
// ------------------------------------------------------------------------------------------------
// label (no input)             |  alle                   |  >= 0             &&   <= infinity
// label                              |   keine               |  >= infinity    &&   <= 0;
// ---------------------------------------------------------------------------------------------      
//  single input  1                | maximal           |   >= 0                         &&    <= input 1
//  single input  1                | minimal            |   >= input 1               && <= infinity
//  single input  1                | ungefähr          |   >= 0.85 *  input 1    &&  <= 1,15 * input 1
//  single input  1               | genau               |   >= input 1                &&  <= input 1
//  --------------------------------------------------------------------------------------------------
//  double input  1  & 2      | von .. biss         |  >= input 1     &&     <= input 2
// 
// Realtions : (time => role)  (role => role ) ... 1:1 ; 1:n; n:1;  n:m.... 
//     type                            | human readable   | machine readable 
// -----------------------------------------------------------------------------------------------
//  double input  1  &  2    | im Verhältnis         | >= input 1 * input 2 &&  <= input 1 * input 2 
//  single input 1                | prozentual            | >= input 1 / 105 && <= input 1 /95
//  single input 1                | pro                       | >= role * input 1
//   
// i thinck we can find  a way to establish or building blocks, human readable rules, machine readable rules, easy ui .... maybe we are already on a good way:
// we will  use   "🕒"  as indicator for timeframe or Zeitraum  and  "🧩" for role/groubs or Aufgaben.
// 
// lets try a systematical approach :-D
  