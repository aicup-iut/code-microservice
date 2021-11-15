# AICup Code Micro-Service 

![AICup](https://img.shields.io/badge/AICup-red)
![version](https://img.shields.io/badge/version-1.0.0-important.svg)


## Files Directories
- Raw Codes: `${file_root}/codes/${code_folder_name}/input/main.{py,cpp,java}`
- Map: `${file_root}/maps/map.json`
- Logs: 
  - `${file_root}/logs/${match_id}/game.json`
  - `${file_root}/logs/${match_id}/server.log`

## Infra APIs
- (compile)
  - POST
  - { _id: string, code_folder_name: string }
- (run_match)
  - POST
  - { match_id: string, team1_file_name: string, team1_name: string, team2_file_name: string, team2_name: string }

## Micro APIs
- /compile-result
  - POST
  - { _id: string, compile_status: enum, compile_message: string }
  - compile_status_enum: [ Error, Success ]
  - compile_message: In case of error
- /match-result
  - POST
  - { match_id: string, winner: boolean }
  - winner: false means first team won
