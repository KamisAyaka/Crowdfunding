# THIS IS AN ANVIL GLOBALLY KNOWN PRIVATE KEY!!
setup-anvil:
	forge script script/deploy.s.sol --rpc-url http://127.0.0.1:8545 --private-key ${ANVIL_KEY} --via-ir --broadcast -vvv

anvil: 
	anvil --dump-state Crowdfunding-anvil.json
