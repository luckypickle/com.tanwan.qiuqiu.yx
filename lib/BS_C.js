var echo = require('../utils/logger');
var CACHE = require('../utils/cache');
var gameData = require('../utils/gameData');
var kvListToObj = require('../utils/kvListToObj');
/**
 *  -- 服务器
     server  -- 主服务器
     battle_server   -- 对战服务器
 * */
// 代码集
var supportList = {
    // 登录游戏成功
    'rpc_client_brpc_login_return': function() {
        //  rpc_client_brpc_login_return({\"result\":0,\"msg\":\"登录游戏成功\"})
        CACHE.battle.runTimeLeft = Date.now();
        CACHE.battle.runTimeLeftUnMerge = Date.now();
        CACHE.battle.bossTrailer = 0;
    },
    // 战斗流程控制开始
    'rpc_client_brpc_proto': function(content) {
        // rpc_client_brpc_proto(\"{\\\"param\\\":{\\\"round\\\":2,\\\"win\\\":1,\\\"seed\\\":0,\\\"record\\\":[]},\\\"action\\\":\\\"battleOver\\\"}\")
        var json = JSON.parse(content);
        /*CTRL_ACTION = {
            ROUND_READY         = "roundReady",
            ROUND_BEGIN         = "roundBegin",
            BOSS_READY          = "bossReady",
            BOSS_BEGIN          = "bossBegin",
            ROUND_OVER          = "roundOver",
            BATTLE_OVER         = "battleOver",
            CONCEDE             = "concede",
            EMOJI               = "emoji",
        }*/
        var action = json.action;
        var param = json.param;
        /*{
            "round": 2,
            "win": 1,
            "seed": 0,
            "record": []
        }*/
        echo("[战斗流程] action:", action);
        if(action === 'battleOver') {
            CACHE.battle.runTimeLeft = -1;
            CACHE.battle.battleType = 0;
            // 回到大厅界面
            return 'local BattlePvpResultPopLayer = require("ui.battle_scene.battle_pvp_result_pop_layer");BattlePvpResultPopLayer:onOKClick();';
        }
    },
    // 客户端战斗帧 - 开始
    'rpc_client_fight_frame_begin': function(frame, gameTime) {
        CACHE.battle.frameBegin = {
            'frame': frame,
            'serverTime': frame * 100,
            'gameTime': gameTime
        };
    },
    // 客户端战斗帧 - 结束
    'rpc_client_fight_frame_end': function() {
        var result = "", i, key, keyList, valueList, _minGrade, allPowenfulBallList,
            playInfo = CACHE.battle.self,
            ballList = playInfo.ballList;
         // 合并球球
         var mergeBall = function(_keyList,is_skip=false) {
            var evalStr = "";
            for (i=0; i < _keyList.length ; i++) { // 循环所有球球，寻找可合并的
                //判断0号位是光棱 且合并球为光棱则跳过

                key = _keyList[i];
 
                var ballItem = CACHE.getBallMergeId(key,false,is_skip);
                
                // 存在可以合并的球球
                if(ballItem) {
                   
                    evalStr += 'battle_server.rpc_server_fight_ball_merge(' + key + ',' + ballItem.ballId + ');';
                    echo('[球球合并] 合并：' + key + ',' + ballItem.ballId);
                    evalStr += 'battle_server.rpc_server_fight_ball_create()'; // 创建球球
                    return evalStr;
                }
                
            }
        };
        // 每次处理间隔时间，目前默认配置 500 毫秒
        if(CACHE.battle.runTimeLeft === -1 || Date.now() - CACHE.battle.runTimeLeft < CACHE.battle.runTimeInterval) {
           
            return;
        }
        CACHE.battle.runTimeLeft = Date.now();
        
        // 抢救球球过后 3s 时间，再造球球，避免出球太快被暗杀、boss击杀
        if(CACHE.battle.killBallMergeTime > 0 && CACHE.battle.runTimeLeft - CACHE.battle.killBallMergeTime < 3000) {
            if( CACHE.battle.is_kill_boss){
                echo("暗杀大师球球判定");
                var get_all_one_star_ball_list = function(){
                    return   Object.values(ballList).filter( (ballItem) => {
                        // 棋盘包含万能球球
                        if(CACHE.battle.battleType ==2){
                            return ballItem.star == 1 && gameData.BattleConst.notMerge.includes(ballItem.ballType);
                        }else{
                            return ballItem.star == 1 ;
                        }
                       
                    });
                    
                };
                var one_star_balls = get_all_one_star_ball_list();
                for(var i =0;i<one_star_balls.length;i++){
                    for(var j=i+1;j<one_star_balls.length;j++){
                        ball = one_star_balls[i];
                        ball1 =  one_star_balls[j];
                        if(ball.ballId != ball1.ballId ){
                            if(ball.ballType == ball1.ballType){
                                evalStr += 'battle_server.rpc_server_fight_ball_merge(' + ball.ballId + ',' + ball1.ballId + ');';
                                echo('[暗杀大师球球合并] 合并：' + ball.ballId + ',' + ball1.ballId);
                                evalStr += 'battle_server.rpc_server_fight_ball_create()'; // 创建球球
                                return evalStr;
                            }
                        }
                    }

                }
                
                //mergeBall(one_star_balls);
            }
            return;
        }

        // 合作模式 BOSS出场等待4秒后才开始操作
        if(CACHE.battle.runTimeLeft -CACHE.battle.MonsterShowTime<4000 && CACHE.battle.battleType ==2 ){
            return;
        }
        
        CACHE.battle.is_kill_boss = false;

        // 有游戏节点
        if(playInfo.cfg) {
            if(playInfo.cfg.sp>playInfo.cfg.cost*100){
                CACHE.battle.spCanMergeBall=true;
            }
            if(CACHE.battle.currentRound>200){
               
                if(playInfo.cfg.sp<playInfo.cfg.cost){
                    CACHE.battle.spCanMergeBall=false
                }
                if(!CACHE.battle.spCanMergeBall)
                {
                    return;
                }
               

            }
            var get_not_merge = function(){
                valueList = Object.values(playInfo.ballsGrade).filter( (item) => {
                    // 非满级 且 不在不升级的纯辅助球球中
                    return gameData.BattleConst.notMerge.includes(item.dbType) && item.dbType != 32;
                });
                return valueList.length;
            }
            if(CACHE.battle.battleType==2&&(CACHE.battle.currentRound<100 ||get_not_merge()==0)){
                return;
            }
            
            // 取升级球球等级需要 Sp点数
            var getGradeSp = function(minGrade) {
                if(minGrade) {
                    var upgradeSp = gameData.BattleConst.DragonBallUpgradeCost[minGrade.grade]; // 根据等级取升级所需 SP
                    return upgradeSp;
                }
            };
            // 取等级最低球球，max 球球可能返回null
            var getMinGrade = function() {
                var minGrade = null;
                // keyList = Object.keys(playInfo.ballsGrade);
                valueList = Object.values(playInfo.ballsGrade).filter( (item) => {
                    // 非满级 且 不在不升级的纯辅助球球中
                    return item.grade <= 4 && !gameData.BattleConst.notUpgrade.includes(item.dbType);
                });
                // 有需要升级 Lv 的球球
                if(valueList.length > 0) {
                    // 球球属性归类：1.攻、2.控、3.辅、4.召
                    keyList = [0, 1, 3, 4, 2]; // 给球球属性归类建立权重
                    // 目前想法是按照作用大小排序：1.攻、4.召、2.控、3.辅
                    valueList.sort( (a, b) => {
                        if(a.grade === b.grade) {
                            var aBallObj = gameData.getBallObj(a.dbType);
                            var bBallObj = gameData.getBallObj(b.dbType);
                            a.weight = keyList[aBallObj.featureType];
                            b.weight = keyList[bBallObj.featureType];
                            return a.weight - b.weight;
                        } else {
                            return a.grade - b.grade;
                        }
                    });
                } else {
                    // 没有需要升级 Lv 的球球，可以考虑升级辅助球球了。
                    valueList = Object.values(playInfo.ballsGrade).filter( (item) => {
                        var gradeSp = getGradeSp(item);
                        // 非满级 且 不在不升级的纯辅助球球中
                        return item.grade <= 4 && playInfo.cfg.sp >= gradeSp;
                    }).sort( (a, b) => {
                        return a.grade - b.grade;
                    });
                }
                if(valueList.length > 0) {
                    minGrade = valueList[0];
                }
                // 遍历等级最小的、依次升级
                /*for (i=0; i < keyList.length ; i++) {
                    key = keyList[i];
                    var item = playInfo.ballsGrade[key];
                    // 判断不是满级球球Lv.Max 和 不升级的辅助球球
                    if(item.grade <= 4 && !gameData.BattleConst.notUpgrade.includes(item.dbType)) {
                        if(minGrade) {
                            // 等级低的
                            if(item.grade < minGrade.grade) {
                                minGrade = item; // 取得等级低的 龙珠
                            }
                        } else {
                            // 第一个
                            minGrade = item;
                        }
                    }
                }*/
                return minGrade;
            };
            _minGrade = getMinGrade();
            // 升级球球等级 ——> Up Lv.*
            var upGrade = function() {
                if(_minGrade) {
                    var upgradeSp = getGradeSp(_minGrade);
                    if(upgradeSp && CACHE.battle.self.cfg.sp >= upgradeSp*2) {
                        echo('[升级球球] ' + _minGrade.name + ' 消耗SP:', upgradeSp, "类型:", _minGrade.dbType);
                        return 'battle_server.rpc_server_fight_ball_upgrade(' + _minGrade.dbType + ')'; // 升级球球
                    }
                }
            };
           

            // var mergeLessBall = function(_keyList){
            //     if(CACHE.battle.currentRound >200&&CACHE.battle.currentRound <1400 &&CACHE.battle.MonsterMergeCount<2 &&(CACHE.battle.currentRound%2==0 && (CACHE.battle.MonsterShowTime !=-1) && (Date.now() - CACHE.battle.MonsterShowTime >CACHE.battle.MonsterSafeInterval) && (Date.now() - CACHE.battle.MonsterShowTime <9000))){
            //         var evalStr = "";
            //         for (i=0; i < _keyList.length ; i++) { // 循环所有球球，寻找可合并的
            //             key = _keyList[i];
            //             var ballItem = CACHE.getLessUnMergeBallId(key);
            //             // 存在可以合并的球球
            //             if(ballItem) {
            //                 evalStr += 'battle_server.rpc_server_fight_ball_merge(' + key + ',' + ballItem.ballId + ');';
            //                 echo('[增强输出球球合并] 合并：' + key + ',' + ballItem.ballId);
            //                 evalStr += 'battle_server.rpc_server_fight_ball_create()'; // 创建球球
            //                 CACHE.battle.MonsterMergeCount +=1;
            //                 return evalStr;
            //             }
            //         }
            //     }
                
            // };

            //竞技模式- 天使不亮且大于3个优先合并，天使不亮且为奇数优先复制天使 --进阶判断位置
            var getAllAngerBallList = function(){
                    return  Object.values(ballList).filter( (ballItem) => {
                        // 棋盘包含万能球球
                        return ballItem.ballType == 49 ;
                    });
            };
            var getAllCopyBallList = function(){
                return  Object.values(ballList).filter( (ballItem) => {
                    // 棋盘包含万能球球
                    return ballItem.ballType == 44;
                });
            };
            
            if (CACHE.battle.battleType == 1){
                allAngerList = getAllAngerBallList();
                allCoypBallList = getAllCopyBallList();
                
                sortedAnger = CACHE.sortBallList (allAngerList);
                sortedCopy = CACHE.sortBallList (allCoypBallList);
                if(allAngerList.length>=2&&allAngerList.length!=3&&allAngerList.length!=5&&allAngerList.length!=7){
                    //优先复制天使
                    for(i =0;i<sortedAnger.length;i++){
                        ball = sortedAnger[i];
                        for(j=0;j<sortedCopy.length;j++){
                            copy = sortedCopy[j];
                            if (ball.star == copy.star ){
                                evalStr = 'battle_server.rpc_server_fight_ball_merge(' + copy.ballId + ',' + ball.ballId + ');';
                                echo('[球球合并] 合并：' + copy.ballId + ',' + ball.ballId);
                                evalStr += 'battle_server.rpc_server_fight_ball_create()'; // 创建球球
                                return evalStr;
                            }
                        }
                    }
                }
                if(playInfo.cfg.sp >= playInfo.cfg.cost) {
                    if(allAngerList.length>3&&allAngerList.length!=3&&allAngerList.length!=5&&allAngerList.length!=7){
                            //其次合并天使
                            //TODO 谁周围的输出球球多就往谁那边合成
                            //TODO 合并卡球
                            for(i =0;i<sortedAnger.length;i++){
                                ball = sortedAnger[i];
                                for(j=0;j<sortedAnger.length;j++){
                                    ball1 = sortedAnger[j];
                                    if(ball.ballId != ball1.ballId){
                                        if(ball1.star == ball.star && ball.star<=6){
                                            star = CACHE.getBallNearAttachStar(ball);
                                            star1 = CACHE.getBallNearAttachStar(ball1);
                                            if(star>star1){
                                                evalStr = 'battle_server.rpc_server_fight_ball_merge(' + ball1.ballId + ',' + ball.ballId + ');';
                                            }else{
                                                evalStr = 'battle_server.rpc_server_fight_ball_merge(' + ball.ballId + ',' + ball1.ballId + ');';
                                            }
                                            
                                            echo('[天使球球合并] 合并：' + ball1.ballId + ','+ ball1.pos + ',' + ball.ballId +','+ ball.pos);
                                            
                                            evalStr += 'battle_server.rpc_server_fight_ball_create()'; // 创建球球
                                            return evalStr;
                                        }
                                        else if(ball1.star > ball.star){
                                            break;
                                        }
                                    }
                                }
                            }
                        
                    }
                }

                //退出条件判断 天使激活且存在周围存在攻击球 赤龙-火凤等
                //如果有复制复制输出球
                var getAllHightAngerBallList = function(){
                    return  Object.values(ballList).filter( (ballItem) => {
                        // 棋盘包含万能球球
                        return ballItem.ballType == 49 && ballItem.star>=6;
                    });
                };
                
                highAngerList = getAllHightAngerBallList();
                if(highAngerList.length>1&&(allAngerList.length==3||allAngerList.length==5||allAngerList.length==7)){
                    keyList = CACHE.getBallKeysSort();
                    //存在高星天使，判断是否存在输出球在附近
                    for(i=0;i<highAngerList.length;i++){
                        posList = CACHE.getBallNearBall(highAngerList[i]);
                        
                        if(posList.length>0){

                            var getAllPowenfulBallList = function() {
                                return Object.values(ballList).filter( (ballItem) => {
                                    // 棋盘包含万能球球
                                    return gameData.BattleConst.allPowerful.includes(ballItem.ballType);
                                });
                            };
                            allPowenfulBallList = getAllPowenfulBallList();
                            // 判断存在万能球，优先合并
                            if(allPowenfulBallList.length > 0) {
                                keyList = allPowenfulBallList.map((pBall)=> {
                                    return pBall.ballId;
                                });
                                result = mergeBall(keyList);
                                if(result) {
                                    return result;
                                }
                            }
                            echo("检测超级输出模式，退出买球")
                            return;
                        }

                    }
                   
                    
                }
                var getAllAttachBall_list = function(){
                    return  Object.values(ballList).filter( (ballItem) => {
                        // 棋盘包含万能球球
                        return ballItem.ballType == 65;
                    });
                }
                attach_ball_stars = 0;
                allAttach = getAllAttachBall_list();
                for(i=0;i<allAttach.length;i++){
                    attach_ball_stars += allAttach[i].star;
                }
                if((allAngerList.length==3||allAngerList.length==5||allAngerList.length==7 )&&attach_ball_stars>30){
                    echo("检测赤龙超多输出模式，退出买球")
                        return;
                }

                //5星以上赤龙存在2个以上，且每个有双天使buf 且天使亮
                is_quit= 0;
                for( i =0;i<allAttach.length;i++){
                    if(allAttach[i].star>=5){
                        att = CACHE.getBallNearAngerStar(allAttach[i])
                        if(att.length>=2){
                            is_quit += att.length-1;
                        }
                    }
                }
                if(is_quit>=2&&(allAngerList.length==3||allAngerList.length==5||allAngerList.length==7 )){
                    echo("检测赤龙天使加成输出模式，退出买球")
                        return;
                }

                var getAllGuanglengBall_list = function(){
                    return  Object.values(ballList).filter( (ballItem) => {
                        // 棋盘包含万能球球
                        return ballItem.ballType == 66 && ballItem.pos!=0;
                    });
                }
                allGuang = getAllGuanglengBall_list()
                guang_star = 0;
                for( i =0;i<allGuang.length;i++){
                    guang_star+=allGuang[i].star
                }
                if(guang_star>=40){
                    echo("检测光棱输出模式，退出买球")
                        return;
                }


            }
            



            // 取棋盘是否存在万能球球
            var getAllPowenfulBallList = function() {
                return Object.values(ballList).filter( (ballItem) => {
                    // 棋盘包含万能球球
                    return gameData.BattleConst.allPowerful.includes(ballItem.ballType);
                });
            };
            allPowenfulBallList = getAllPowenfulBallList();
            // 判断存在万能球，优先合并
            if(allPowenfulBallList.length > 0) {
                //获取0号位球球，判断是否满足优先合并0号位
                var getZeroPos = function(){
                    return Object.values(ballList).filter( (ballItem) => {
                        // 棋盘包含万能球球
                        return ballItem.pos ==0 && ballItem.ballType ==66;
                    });
                }
                zeroPos = getZeroPos()
                if(zeroPos.length>0){
                    for(i=0;i<allPowenfulBallList.length;i++){
                        //echo(allPowenfulBallList[i],zeroPos[0])
                        if(allPowenfulBallList[i].ballId != zeroPos[0].ballId&&allPowenfulBallList[i].star == zeroPos[0].star && allPowenfulBallList[i].ballType == 39){
                            evalStr = 'battle_server.rpc_server_fight_ball_merge(' + allPowenfulBallList[i].ballId + ',' + zeroPos[0].ballId + ');';
                            echo('[0号位优先升星] 合并：' + allPowenfulBallList[i].ballId + ','+allPowenfulBallList[i].pos + ',' + zeroPos[0].ballId +','+ zeroPos[0].pos);
                            evalStr += 'battle_server.rpc_server_fight_ball_create()'; // 创建球球
                            return evalStr;
                        }
                    }
                }

                keyList = allPowenfulBallList.map((pBall)=> {
                    return pBall.ballId;
                });

                result = mergeBall(keyList,true);
                if(result) {
                    return result;
                }
            }
            //判断存在繁衍球球优先合并
            var getAllExtendBallList = function(){
                return Object.values(ballList).filter( (ballItem) => {
                    // 棋盘包含万能球球
                    return ballItem.ballType==33 ||ballItem.ballType ==1000;
                });
            }
            allExtendBall = getAllExtendBallList()
            if (allExtendBall.length>0){
                keyList = allExtendBall.map((pBall)=> {
                    return pBall.ballId;
                });
                result = mergeBall(keyList);
                if(result) {
                    return result;
                }
            }
			//快速合刀
            if(CACHE.battle.battleType==1 &&CACHE.battle.otherStart){
                var mergeKillBall = function(_keyList) {
                    var evalStr = "";
                    for (i=0; i < _keyList.length ; i++) { // 循环所有球球，寻找可合并的
                        key = _keyList[i];
                        var ballItem = CACHE.getKillBallMergeId(key);
                        // 存在可以合并的球球
                        if(ballItem) {
                            evalStr += 'battle_server.rpc_server_fight_ball_merge(' + key + ',' + ballItem.ballId + ');';
                            echo('[kill球球合并] 合并：' + key + ',' + ballItem.ballId);
                            evalStr += 'battle_server.rpc_server_fight_ball_create()'; // 创建球球
                            return evalStr;
                        }
                        
                    }
                };
                keyList = CACHE.getBallKeysSort();
                result = mergeKillBall(keyList);
                if(result) {
                    return result;
                }
            }
			
            // 判断球球 Lv
            if(_minGrade) { // 有等级最低球球
                keyList = Object.keys(CACHE.battle.self.ballList);
                // 棋盘满了 - 优先提升整体 Lv
                if(keyList.length >= playInfo.ballMaxNum) {
                    // 200+ SP 升级 Lv.3
                    if(playInfo.cfg.cost >= 150 && _minGrade.grade < 2) {
                        // 升级球球
                        return upGrade();
                    } else if(playInfo.cfg.cost >= 200 && _minGrade.grade < 3) {
                        // 升级球球
                        return upGrade();
                    } else if(playInfo.cfg.cost >= 300 && _minGrade.grade < 4) {
                        // 升级球球
                        return upGrade();
                    } else if(playInfo.cfg.cost >= 350 && _minGrade.grade < 5) {
                        // 升级球球
                        return upGrade();
                    }
                }
            }

            //判断是否合球的sp
            var checkIsMerge =function(sp,cost){
                if (cost < 300){
                    return sp >=cost*2;
                }
                if(cost <450){
                    return sp>=cost*2;
                }
                if(cost<700){
                    return sp >=cost*3;
                }
                return sp>=cost*3;

            }
            // SP 大于创造球球
            if(playInfo.cfg.sp >= playInfo.cfg.cost) {
                // keyList = Object.keys(ballList);
                keyList = CACHE.getBallKeysSort(); // 排序
                keyListSuper = CACHE.getBallKeysSortSuper(); // 排序
                // 总球数少于 15 个可以创建球球
                if(keyList.length < playInfo.ballMaxNum) {
                    CACHE.battle.runTimeLeft = Date.now()-(CACHE.battle.runTimeInterval-200);
                    return 'battle_server.rpc_server_fight_ball_create()'; // 创建球球
                } else if(checkIsMerge(playInfo.cfg.sp , playInfo.cfg.cost)) {
                    // 球球满了
                    result = mergeBall(keyListSuper);
                    if(result) {
                        return result;
                    } else {
                        // result = mergeLessBall(keyList);
                        // if(result){
                        //     return result;
                        // }else{
                            return upGrade(); // 升级
                        //}

                        
                    }
                }
                else{
                    return;
                }
            } else {
                // 判断天胡 开局
                keyList = Object.keys(ballList);
                if(keyList.length === 4) { // 开局四抽
                    var tempBallType = {};
                    for(i=0; i < 4 ;i++) {
                        key = keyList[i++];
                        tempBallType[ballList[key].ballType] = true;
                    }
                    // 合并后的 球球类型 只有一种
                    keyList = Object.keys(tempBallType);
                    if(keyList.length === 1) {
                        // 判断 球球在 天胡自动合并配置中
                        if(gameData.BattleConst.startToMerge.includes(keyList[0])) {
                            return mergeBall([ ballList[0].ballId ]); // 合并球球
                        }
                    }
                }
                // 升级球球
                if(keyList.length>5){
                    return upGrade();

                }
                return;
                
            }
        }
    },
    // 游戏结束
    'rpc_client_fight_end': function() {
        // rpc_client_fight_end()
        CACHE.battle.runTimeLeft = -1;
        CACHE.battle.runTimeLeftUnMerge = -1;
        CACHE.battle.battleType = 0;
        CACHE.battle.otherStart =false;
        // 回到大厅界面
        return 'local BattlePvpResultPopLayer = require("ui.battle_scene.battle_pvp_result_pop_layer");BattlePvpResultPopLayer:onOKClick();';

        
    },
    // 在轮次开始之间播放boss预告
    'rpc_client_fight_boss_trailer': function (bossType) {
        /*BattleConst.BossType = {
            Knight = 101,	-- 骑士（转王）
            Magician = 102,	-- 魔术师
            Imprison = 103,	-- 禁锢
            Summoner = 104,	-- 召唤师
            Assassinator = 105,	-- 暗杀大师
        }*/
        CACHE.battle.bossTrailer = bossType;
    },
    // 轮次开始
    'rpc_client_fight_round_begin': function (time, round) {
        // rpc_client_fight_round_begin(120,1)
        // time = BOSS 来临倒计时？
        CACHE.battle.MonsterShowTime = -1;
        CACHE.battle.roundMonsterCount = 0;
        CACHE.battle.runUnMergeCount = 0;
        CACHE.battle.MonsterCurrentCount = 0;
        CACHE.battle.round = round; // 战斗第几回合
        CACHE.battle.currentRound = round;
        
        
        CACHE.battle.Monster = [];
        CACHE.battle.MonsterMergeCount=0;
        echo('开始第' + round + '回合');
        if(CACHE.battle.battleType!=2){
            return 'battle_server.rpc_server_fight_ball_create()';
        }else{
            return;
        }
        
    },
    // 轮次结束
    'rpc_client_fight_round_end': function () {

    },
    /**
     * 战斗球攻击
     * @param ballId
     * @param attackInfo
     *  {
            "targetIds": [33],      攻击目标
            "bulletSpeed": 2000,    子弹速度
            "defaultDamage": 20,    攻击伤害
            "interval": 500         攻击间隔
        }
     */
    'rpc_client_fight_ball_attack': function(ballId, attackInfo) {

       // echo(data.ballType,ballId,attackInfo)
        // rpc_client_fight_ball_attack(25,{\"targetIds\":[33],\"bulletSpeed\":2000,\"defaultDamage\":20,\"interval\":500})"]
        //echo("CACHE.startCollect",CACHE.startCollect)
        // if(CACHE.startCollect==true){
        //     var data =  CACHE.getBallById(ballId);
        //     if(!data){
        //         if ( !CACHE.chatList.includes(ballId) ){
        //             echo(ballId,attackInfo);
        //             CACHE.chatList.push(ballId);
        //          }
        //     }
        // }
       
        
        
    },
    /**
     * 怪物受到伤害
     * @param hurtList
     * [{
            "damageList": [{
                "damageType": 0,    // 0:子弹 1:火 2:电 3:毒
                "isCrit": 0,
                "attackStar": 0,
                "damage": [0, 20],
                "extraList": [],
                "attackerId": 45
            }],
            "isFatal": 0,
            "monsterId": 33
        }]
     */
    'rpc_client_fight_monster_hurt': function(hurtList) {
        // rpc_client_fight_monster_hurt([{\"damageList\":[{\"damageType\":0,\"isCrit\":0,\"attackStar\":0,\"damage\":[0,20],\"extraList\":[],\"attackerId\":30},{\"damageType\":0,\"isCrit\":0,\"attackStar\":0,\"damage\":[0,20],\"extraList\":[],\"attackerId\":30}],\"isFatal\":0,\"monsterId\":33}])
        //for(var i in hurtList[0]["damageList"]){
        //    var x = hurtList[0]["damageList"][i]
        //    if (x["damageType"]==7){
        //        echo(x["damage"])
        //    }
       // }
     // echo(hurtList[0]["damageList"][0]["damage"])
    },
    'rpc_client_fight_ball_hit_monster_cnt':function(a,b,c){

    },
    // 同步怪物信息
    'rpc_client_fight_monster_sync_info': function (monsterId, monsterInfo) {
        // hp - 血
        // distance - 距离
        // moveSpeed - 移动速度
        // rpc_client_fight_monster_sync_info(69,{\"infoList\":[{\"k\":\"distance\",\"v\":0}]})
        monsterInfo.infoList = kvListToObj(monsterInfo.infoList);
    },
    /**
     * hp
     * @param side - 敌方、我方
     * @param hp
     */
    'rpc_client_fight_player_hp': function (side, hp) {
        if(CACHE.battle.selfIndex === side) {
            // 更新数据
            if(CACHE.battle.self) {
                CACHE.battle.self.cfg.hp = hp;
            }
        }
    },
    /**
     * sp
     * @param side
     * @param curSp
     * @param nextBallSp
     */
    'rpc_client_fight_player_sp': function (side, curSp, nextBallSp) {
        // 确认玩家
        if(CACHE.battle.selfIndex === side) { // 玩家自己
            // 更新数据
            if(CACHE.battle.self) {
                CACHE.battle.self.cfg.sp = curSp;
                CACHE.battle.self.cfg.cost = nextBallSp;
            }
            // 经费足够升级
            // if (curSp >= nextBallSp) {
                // rpc_client_fight_frame_end 方法中实现
                // return 'battle_server.rpc_server_fight_ball_create()'; // 创建球球
            // }
        }
    },
    // 创建怪物
    'rpc_client_fight_monster_create': function(monsterId, monsterType, monsterBaseInfo) {
        // rpc_client_fig   ht_monster_create(48,1,{\"infoEx\":[],\"moveSpeed\":100,\"hp\":[0,300],\"side\":2,\"distance\":0})"]
        CACHE.battle.MonsterCurrentCount +=1;

         if(CACHE.battle.selfIndex === monsterBaseInfo.side) {

            if(monsterType >= 101 && monsterType <= 106) {
                var monster = gameData.BattleConst.monster[monsterType];
                    echo('BOSS', monster.name, '登场，ID:', monsterId,'描述：', monster.desc);
                    CACHE.battle.Monster.push(monsterType);
                    CACHE.battle.MonsterShowTime = Date.now();
                }
            }
            if( monsterType ==105){
                //暗杀BOSS合并所有一星球
                echo('BOSS', monster.name, '登场，ID:', monsterId,'描述：', monster.desc);
                CACHE.battle.is_kill_boss = true;
                CACHE.battle.killBallMergeTime = Date.now()+3000;
            }

    


		// 		var monster = gameData.BattleConst.monster[monsterType];
		// 		// 只输出 BOSS 信息，boss ID 区间 101 ~ 106
		// 		if(monsterType >= 101 && monsterType <= 106) {
        //             echo('BOSS', monster.name, '登场，ID:', monsterId,'描述：', monster.desc);
        //             CACHE.battle.Monster.push(monsterType);
        //             CACHE.battle.MonsterShowTime = Date.now();
        //         }
        //         CACHE.battle.MonsterType = monsterType
        //         CACHE.battle.roundMonsterCount +=1
                

                    
        //             var UnmergeBall = function(_keyList) {
        //                 var evalStr = "";
        //                 for (i=0; i < _keyList.length ; i++) { // 循环所有球球，寻找可合并的
        //                     key = _keyList[i];
        //                     var ballItem = CACHE.getUnMergeBallId(key);
        //                     // 存在可以合并的球球
        //                     var mergeFromObj = CACHE.getBallById(key);
        //                     if(ballItem) {
        //                         evalStr += 'battle_server.rpc_server_fight_ball_merge(' + key + ',' + ballItem.ballId + ');';
        //                         echo('[特殊球球合并] 合并：' + key + ',' + ballItem.ballId,ballItem.ballType,mergeFromObj.ballType,mergeFromObj.star,ballItem.star);
        //                         evalStr += 'battle_server.rpc_server_fight_ball_create()'; // 创建球球
        //                         if (mergeFromObj.star>=3 && mergeFromObj.ballType===40){
        //                             CACHE.battle.runUnMergeCount+=3;
                                    
        //                         }else{
        //                             CACHE.battle.runUnMergeCount+=1;
                                   
        //                         }
                                
        //                         return evalStr;
        //                     }
                           
        //                 }
        //             };
        
        
        //                 //echo("CACHE.battle.currentRound ",CACHE.battle.currentRound ,"CACHE.battle.roundMonsterCount",CACHE.battle.roundMonsterCount,"monsterType",CACHE.battle.MonsterType,"CACHE.battle.currentRound%2",CACHE.battle.currentRound%2)
        //                 if(CACHE.battle.currentRound >200 && CACHE.battle.currentRound <1300  && CACHE.battle.roundMonsterCount<9 &&(CACHE.battle.roundMonsterCount>3&& CACHE.battle.MonsterCurrentCount<3) && ((CACHE.battle.currentRound%2)==1) &&(CACHE.battle.MonsterType < 101 || CACHE.battle.MonsterType > 106)){
        //                 //    //echo('match merge')
        //                     keyList = CACHE.getBallKeysSort();
        //                   result = UnmergeBall(keyList);
                            
        //                    if(result) {
        //                         echo("处理结果",result)
        //                      return result;
        //                     }
        //                 }
                
        // }
    },
    // 销毁怪物
    'rpc_client_fight_monster_destroy': function(monsterId) {
        CACHE.battle.MonsterCurrentCount -=1;
        //echo(CACHE.battle.MonsterCurrentCount);

    },
    // 怪物状态 - 添加
    'rpc_client_fight_monster_status_add': function (monsterId, statusInfo) {
        // type 类型 参考 gameData.BattleConst.StatusType
        // rpc_client_fight_monster_status_add(22,{"casterId":20,"lv":1,"extraInfo":[],"id":24,"type":"imprison"})
    },
    // 怪物状态 - 升级
    'rpc_client_fight_monster_status_update': function (monsterId, statusInfo) {
        // rpc_client_fight_monster_status_update(82,{"casterId":20,"lv":1,"extraInfo":[],"id":89})
    },
    // 怪物状态 - 删除
    'rpc_client_fight_monster_status_remove': function (monsterId, statusInfo) {

    },
    //释放技能
    'rpc_client_fight_ball_skill':function(fightInfo){

    },
    // 创建球球
    'rpc_client_fight_ball_create': function (ballId, ballType, ballInfo) {
        // rpc_client_fight_ball_create(13,38,{"pos":14,"side":1,"star":1})
        // rpc_client_fight_ball_create(1237,21,{\"pos\":8,\"side\":1,\"star\":2})
        // 确认玩家
        if(ballInfo.side ===  CACHE.battle.selfIndex) {
            // 玩家自己
            var pos = ballInfo.pos; // 服务器是0，js 也是0
            var ballData = {
                ballId: ballId, // 球球实例ID
                ballType: ballType, // 球球ID
                ballName: gameData.getBallObj(ballType).name, // 球球名字
                pos: pos, // 棋盘坐标
                star: ballInfo.star // 球球星级
            };
            CACHE.battle.self.ballList[ballId] = ballData;
            // console.log('[我方] 创造球球：', ballData.ballName, 'ID:', ballData.ballId, 'STAR:', ballData.star);
        }else{
            CACHE.battle.otherStart = true
        }
    },
    // 销毁球球
    'rpc_client_fight_ball_destroy': function(ballId) {
        var ballItem = CACHE.battle.self.ballList[ballId];
        if(ballItem) { // 存在 球球的，对比ID
            // console.log('[我方]', '删除球球:', ballItem.ballName, 'ID:', ballItem.ballId, 'STAR:', ballItem.star);
            delete CACHE.battle.self.ballList[ballId];
        }
    },
    // 球球状态 - 添加
    'rpc_client_fight_ball_status_add': function(ballId, statusInfo) {
        // type 类型 参考 gameData.BattleConst.StatusType
        // "ball_kill",		-- 暗杀龙珠目标
        // "boss_kill",		-- boss摧毁目标
        // rpc_client_fight_ball_status_add(182,{\"casterId\":103,\"lv\":1,\"extraInfo\":[{\"k\":\"fromPos\",\"v\":13}],\"id\":206,\"type\":\"ball_kill\"})
        // rpc_client_fight_ball_status_add(2456,{\"casterId\":2467,\"lv\":1,\"extraInfo\":[{\"k\":\"fromPos\",\"v\":11}],\"id\":2470,\"type\":\"ball_kill\"})
        /*{
            "casterId": 77,
            "lv": 1,
            "extraInfo": [{
                "k": "fromPos",
                "v": 8
            }],
            "id": 113,
            "type": "ball_kill"
        }*/
        var result = "", mergeBall;
        var playInfo = CACHE.battle.self;
        var ballList = playInfo.ballList;
        var ballItem = ballList[ballId];
        // 确认玩家 - 如果在我方棋盘找到 该球球ID 就说明 技能目标是我方球球
        if(ballItem &&CACHE.battle.battleType!=2) {
            // 判断 暗杀龙珠目标 且 非合作模式
            if(statusInfo.type === 'ball_kill' && CACHE.battle.battleType != 2) {
                // rpc_server_fight_ball_merge(from, to) 合并
                mergeBall = CACHE.getBallMergeId(ballItem.ballId, true);
                if(mergeBall) {
                    result += 'battle_server.rpc_server_fight_ball_merge(' + ballId + ',' + mergeBall.ballId + ');';
                    echo('[球球合并] 暗杀球球目标抢救，合并：' + ballId + ',' + mergeBall.ballId);
                    echo('[球球合并] 暗杀球球目标抢救，合并pos：' + ballItem.pos+ ','+ mergeBall.pos );
                    CACHE.battle.killBallMergeTime = Date.now();
                }
            }
            // 判断 boss摧毁目标
            if(statusInfo.type === 'boss_kill') {
                // rpc_server_fight_ball_merge(from, to) 合并
                mergeBall = CACHE.getBallMergeId(ballItem.ballId, true);
                if(mergeBall) {
                    result += 'battle_server.rpc_server_fight_ball_merge(' + ballId + ',' + mergeBall.ballId + ');';
                    echo('[球球合并] boss摧毁目标抢救，合并：' + ballId + ',' + mergeBall.ballId);
                    echo('[球球合并] 暗杀球球目标抢救，合并pos：' + ballItem.pos+ ','+ mergeBall.pos );
                    CACHE.battle.killBallMergeTime = Date.now();
                }
            }
        }
        return result;
    },
    // 球球状态 - 升级
    'rpc_client_fight_ball_status_update': function (ballId, statusInfo) {

    },
    // 球球状态 - 删除
    'rpc_client_fight_ball_status_remove': function (ballId, statusId) {
        // rpc_client_fight_ball_status_remove(30,152)
    },
    // 战斗球 Lv 升级
    'rpc_client_fight_ball_upgrade': function(side, ballType, ballGrade) {
        // rpc_client_fight_ball_upgrade(2,24,3)
        // 判断玩家 - 自己
        if(side === CACHE.battle.selfIndex) {
            CACHE.battle.self.ballsGrade[ballType].grade = ballGrade;
        }
    },
    // 路线道具 - 添加
    'rpc_client_fight_creature_add': function(creatureId, creatureInfo) {

    },
    // 路线道具 - 删除
    'rpc_client_fight_creature_remove': function(creatureId) {

    },
    'rpc_client_fight_ball_recharge':function(){

    },
    'rpc_client_fight_ball_awake':function(){

    },
    'rpc_client_fight_creature_update':function(){

    },
    // 发送表情包
    'rpc_client_fight_emoji': function(side, emojiId) {
        if(side !== CACHE.battle.selfIndex) {
            //return 'battle_server.rpc_server_fight_emoji(' + emojiId + ');';
        }
    },
    // 暂停
    'rpc_client_fight_pause': function () {},
    // 继续
    'rpc_client_fight_resume': function () {},
    'rpc_client_fight_ball_props':function(){},
    // 战斗怪物刷新
    'rpc_client_fight_monster_refresh': function(monsterList) {
        // rpc_client_fight_monster_refresh([{\"distance\":20,\"id\":654},{\"distance\":20,\"id\":653}])
    },
    // 提示信息1
    'rpc_client_tell_me': function(color, str) {
        // rpc_client_tell_me(6,\"[\\\"更新成功\\\"]\")
        echo('[提示信息]', str);
    },
};
// 战斗：服务器 -> 客户端
function BS_C(handleStr) {
    var result, evalStr;
    if(new RegExp(Object.keys(supportList).join("|")).test(handleStr)) {
        CACHE.DEBUG && echo.log('[记录日志] [BS_C] ' + handleStr);
        // 处理方法
        try{
            evalStr = "supportList." + handleStr;
            //echo("[Eval]", evalStr);
            result = eval(evalStr);
            if(result) {
                // echo('[BS->C 处理代码]', handleStr, "\n[处理结果]", result);
            } else {
                result = "DEBUG = 4"; // 空代码执行
                // echo('[无法处理代码]', handleStr);
            }
        }catch (e) {
            echo('[不支持的执行代码]', handleStr, e.message);
        }
    } else {
        // 未处理
    }
    return result;
}

module.exports = BS_C;