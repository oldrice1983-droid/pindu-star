# -*- coding: utf-8 -*-
"""补 9 个高频缺失词（congratulations/vegetables/grandpa/parents/wednesday/mango/excited/bored/thanks）
按 WORDS_EXTRA 既有字段格式生成并插入到数组末尾。"""
import io, json

R = 'rule:"<b>多音节词</b>：先找准重读音节，非重读的元音常弱化成 /ə/（schwa），这是听懂长词的关键"'
RC = 'rule:"<b>元音组合</b>：两个元音字母组合起来读一个音，组合多为固定发音"'

E = []
def add(w, ip, pos, zh, syl, stress, chunks, rule, exam, lv, forms=None, colstar=3, stress2=None):
    s = '{w:"%s",ip:"/%s/",pos:"%s",zh:"%s",auto:1,syl:[%s],stress:%d,forms:%s,col:{star:%d,en:"<b>%s</b> %s",zh:"%s"},chunks:[%s],%s,phrases:[],sent:["The word \\"%s\\" means {zh}.","「%s」的意思是%s。"],exam:[%s],lv:%d,it:"%s",dict:{"ox":1}%s},' % (
        w, ip, pos, zh,
        ",".join('["%s","%s"]' % (a, b) for a, b in syl),
        stress, ('"%s"' % forms) if forms else "null", colstar, w, pos, zh,
        ",".join('["%s","/%s/","%s","%s"%s]' % (c[0], c[1], c[2], c[3], ",null" if len(c) > 4 else "") for c in chunks),
        rule, w, w, zh,
        ",".join('"%s"' % x for x in exam), lv, "基础" if lv <= 2 else "进阶",
        (",stress2:%d" % stress2) if stress2 is not None else "")
    E.append(s)

add("congratulations","kənɡrætʃəleɪʃənz","int.","恭喜, 祝贺",
    [("con","kən"),("gra","ɡræ"),("tu","tʃə"),("la","leɪ"),("tions","ʃənz")],3,
    [("c","k","k","ec · can",1),("o","ə","uh","our · ago"),("n","n","n","in · on",1),
     ("g","ɡ","g","go · get",1),("r","r","r","try · run",1),("a","æ","a","at · as"),
     ("t","tʃ","ch","etch · watch",1),("u","ə","uh","our · hour"),
     ("l","l","l","all · old",1),("a","eɪ","ay","say · may"),
     ("t","ʃ","sh","shot · shut",1),("io","ə","uh","via · ion"),
     ("n","n","n","in · on",1),("s","z","s","easy · news",1)],
    R,["中考","高考","四级"],2,None,3,1)

add("vegetables","vedʒətəbəlz","n.","蔬菜",
    [("ve","ve"),("ge","dʒə"),("tables","təbəlz")],0,
    [("v","v","v","via · van",1),("e","e","eh","ec · get"),("g","dʒ","j","age · jog",1),
     ("e","ə","uh","the · era"),("t","t","t","to · it",1),("a","ə","uh","ago · era"),
     ("b","b","b","be · by",1),("l","l","l","all · old",1),("e","ə","uh","ago · era"),
     ("s","z","s","easy · news",1)],
    R,["中考","高考"],1,"复数 vegetables")

add("grandpa","ɡrænpɑː","n.","爷爷, 外公, 老爷爷",
    [("grand","ɡræn"),("pa","pɑː")],0,
    [("g","ɡ","g","go · get",1),("r","r","r","try · run",1),("a","æ","a","at · as"),
     ("n","n","n","in · on",1),("d","d","d","do · ad",1),
     ("p","p","p","up · put",1),("a","ɑː","ar","far · arm")],
    'rule:"<b>多音节词</b>：先找准重读音节；词尾 -pa 读开音节长音 /ɑː/"',["中考"],1)

add("parents","perənts","n.","父母, 双亲",
    [("pa","pe"),("rents","rənts")],0,
    [("p","p","p","up · put",1),("a","e","eh","any · many"),("r","r","r","try · run",1),
     ("e","ə","uh","the · era"),("n","n","n","in · on",1),("t","t","t","to · it",1),
     ("s","s","s","us · so",1)],
    R,["中考","高考"],1,"复数 parents")

add("wednesday","wenzdeɪ","n.","星期三",
    [("wednes","wenz"),("day","deɪ")],0,
    [("w","w","w","we · way",1),("e","e","eh","ec · get"),("d","d","d","do · ad",1),
     ("n","n","n","in · on",1),("e","ə","uh","ago · era"),("s","z","s","easy · news",1),
     ("d","d","d","do · ad",1),("ay","eɪ","ay","say · may")],
    'rule:"<b>特殊拼写</b>：Wednesday 中第一个 d 不发音，读 /ˈwenz·deɪ/，需整体记忆"',["中考","高考"],1)

add("mango","mæŋɡəʊ","n.","芒果",
    [("man","mæŋ"),("go","ɡəʊ")],0,
    [("m","m","m","my · me",1),("a","æ","a","at · as"),("n","ŋ","ng","ink · long",1),
     ("g","ɡ","g","go · get",1),("o","əʊ","oh","go · so")],
    'rule:"<b>闭音节 + 开音节</b>：man 闭音节读 /æ/；go 开音节读字母名 /əʊ/；n 在 g 前读鼻音 /ŋ/"',["中考"],1)

add("excited","ɪksaɪtɪd",None,"a. 兴奋的, 激动的",
    [("ex","ɪk"),("ci","saɪ"),("ted","tɪd")],1,
    [("e","ɪ","i","give · very"),("x","ks","x","box · six",1),
     ("c","s","s","ice · icy",1),("i","aɪ","eye","hi · die"),
     ("t","t","t","to · it",1),("ed","d","d","played · opened",1)],
    'rule:"<b>多音节词</b>：ex- 前缀不重读；重音落在 ci（/saɪ/）；词尾 -ed 读 /d/"',["中考","高考"],2,None,3)

add("bored","bɔːd",None,"a. 无聊的, 厌烦的",
    [("bored","bɔːd")],0,
    [("b","b","b","be · by",1),("or","ɔː","or","or · nor"),("ed","d","d","played · opened",1)],
    'rule:"<b>r 音节 + 词尾 ed</b>：or 读 /ɔː/；-ed 前面是浊音读 /d/，e 不发音"',["中考"],1)

add("thanks","θæŋks","n.","谢谢, 感谢",
    [("thanks","θæŋks")],0,
    [("th","θ","th","math · this",1),("a","æ","a","at · as"),("n","ŋ","ng","ink · long",1),
     ("k","k","k","ask · key",1),("s","s","s","us · so",1)],
    'rule:"<b>辅音组合</b>：th 读清音 /θ/；n 在 k 前读鼻音 /ŋ/，需整体拼读"',["中考","高考"],1)

p = "ios-pack/www/index.html"
s = io.open(p, encoding="utf-8").read()
# 找到 WORDS_EXTRA 数组结尾（第一个 "\n];" 紧跟 well-being 条目之后）
anchor = 'dict:{}}\n];\nWORDS.push.apply(WORDS,WORDS_EXTRA);'
assert s.count(anchor) == 1, "anchor not found: %d" % s.count(anchor)
block = "\n".join(E)
s = s.replace(anchor, 'dict:{}},\n' + block + '\n];\nWORDS.push.apply(WORDS,WORDS_EXTRA);')
io.open(p, "w", encoding="utf-8").write(s)
print("inserted", len(E), "entries")
