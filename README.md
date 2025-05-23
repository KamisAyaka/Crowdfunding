curl -H "Content-Type: application/json" -X POST --data '{
    "jsonrpc":"2.0",
    "method":"evm_increaseTime",
    "params":[86400],  
    "id":1
}' http://localhost:8545
