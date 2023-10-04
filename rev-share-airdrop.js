var ethers = require('ethers');  
var fs = require('fs');
var arbitrum_rpc = 'https://arbitrum.llamarpc.com';
var optimism_rpc = 'https://optimism.llamarpc.com';

var customHttpProviderOptimism = new ethers.providers.JsonRpcProvider(optimism_rpc);
var customHttpProviderArbitrum = new ethers.providers.JsonRpcProvider(arbitrum_rpc);

const NFTContractABI  = [{"inputs":[{"internalType":"uint256","name":"tokenId","type":"uint256"}],"name":"ownerOf","outputs":[{"internalType":"address","name":"","type":"address"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"totalSupply","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"}];
const NFTcontractAddress = "0x66Deb6cC4d65dc9CB02875DC5E8751d71Fa5D50E";
const NFTcontract = new ethers.Contract(NFTcontractAddress, NFTContractABI, customHttpProviderOptimism);

const xL2DAOContractABI  = [{"stateMutability":"view","type":"function","name":"balanceOf","inputs":[{"name":"addr","type":"address"},{"name":"_t","type":"uint256"}],"outputs":[{"name":"","type":"uint256"}]}];
const xL2DAOcontractAddress = "0xA7AF63b5154eB5d6Fb50a6d70d5C229e5f030AB2";
const xL2DAOcontract = new ethers.Contract(xL2DAOcontractAddress, xL2DAOContractABI, customHttpProviderArbitrum);

const revenueContractABI  = [{"name":"tokens_per_week","outputs":[{"type":"uint256","name":""}],"inputs":[{"type":"uint256","name":"arg0"}],"stateMutability":"view","type":"function"},{"name":"ve_for_at","outputs":[{"type":"uint256","name":""}],"inputs":[{"type":"address","name":"_user"},{"type":"uint256","name":"_timestamp"}],"stateMutability":"view","type":"function"},{"name":"ve_supply","outputs":[{"type":"uint256","name":""}],"inputs":[{"type":"uint256","name":"arg0"}],"stateMutability":"view","type":"function"}];
const revenueContractAddress = "0xC15DDD98341346A2d2C9bf0187f56666247dF4C6";
const revenueContract = new ethers.Contract(revenueContractAddress, revenueContractABI, customHttpProviderArbitrum);

const WEEK = 604800;
const currentTime = Math.round(new Date().getTime() / 1000);

let last_epoch_start_time = Math.floor((currentTime-WEEK) / WEEK) * WEEK; 

console.log("Last Epoch timestamp: ",last_epoch_start_time);
console.log("Last Epoch start time: ",new Date(last_epoch_start_time*1000).toLocaleDateString("en-US", { timeZone: 'UTC' }),new Date(last_epoch_start_time*1000).toLocaleTimeString("en-US", { timeZone: 'UTC' }));

var totalSupply = 0;
var tokenOwners = [];
var tokens_in_epoch;
var ve_supply;
var txList = [['token_type,token_address,receiver,amount,id']];

async function loadHolders(){
    // read method
    await NFTcontract.totalSupply()
    .then((output) => 
        console.log("Total NFT Supply: ",totalSupply = output.toNumber())
    );

    await revenueContract.ve_supply(last_epoch_start_time)
    .then((output) => 
        console.log("ve supply: ",ve_supply = ethers.utils.formatEther(output))
    );

    await revenueContract.tokens_per_week(last_epoch_start_time)
    .then((output) => 
        console.log("ETH in last Epoch: ",tokens_in_epoch = ethers.utils.formatEther(output))
    );
    

    i = 1;
    while(i<=totalSupply){
        console.log("Checking token ID",i);
        let tokenOwner;

        let numTries;
        while (true) {
            numTries = 5;
            try {
                await NFTcontract.ownerOf(i).then((address) => tokenOwner = address);
                break;
            } catch (error) {
                console.log("ERROR -- RETRYING");
                if (--numTries < 1) throw(error);
            }
        }
        

        if ( ! tokenOwners.includes(tokenOwner) ) {
            tokenOwners.push(tokenOwner)
            console.log("Owner: ",tokenOwner);
    
            let ve_for_at;
    
            while (true) {
                numTries = 5;
                try{
                    await revenueContract.ve_for_at(ethers.utils.getAddress(tokenOwner),last_epoch_start_time)
                    .then((balance) => console.log("xL2DAO Balance: ",ve_for_at = ethers.utils.formatEther(balance)));
                    break;
                } catch (error) {
                    console.log("ERROR -- RETRYING");
                    if (--numTries < 1) throw(error);
                }
            }
    
            if ( ve_for_at > 0 ) {
                let ve_share = ve_for_at / ve_supply;
                let eth_share = ve_share * tokens_in_epoch;
    
                console.log("Percentage share of weekly pool: ",ve_share*100);
                console.log("----> Owner will receive rev share");
                console.log("Allocated ETH: ",Number(eth_share).toFixed(18));
    
                txList.push(['erc20','',tokenOwner,Number(eth_share).toFixed(18),'']);
            }
        }
        i++;
    }
    console.log(txList);
    let csv = txList.join('\n');
    fs.writeFile('./airdrop_data/txList'+last_epoch_start_time+'.csv', csv, 'utf8', function(err) {
        if (err) {
          console.log('Some error occured - file either not saved or corrupted file saved.');
        } else {
          console.log('It\'s saved!');
        }
    });
}

loadHolders();