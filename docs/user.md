# 关于用户

## 删除用户

- 发送消息

```json
{"action":"deleteuser","userid":"user//test","username":"test"}
```

- 返回消息

```json
{"action":"event","event":{"etype":"user","userid":"user//test","username":"test","action":"accountremove","msgid":63,"msg":"Account removed","domain":"","time":"2026-09-08T06:38:39.200Z"}}
```

## 新增用户

- 添加用户

```json
{"action":"adduser","username":"test","email":"test@qq.com","pass":"","resetNextLogin":false,"randomPassword":true,"removeEvents":false}
``

- 返回消息

```json
{"action":"event","event":{"etype":"user","userid":"user//test","username":"test","account":{"_id":"user//test","name":"test","creation":1788849697,"email":"test@qq.com","passchange":1788849697},"action":"accountcreate","msgid":65,"msgArgs":["test@qq.com"],"msg":"Account created, email is test@qq.com","domain":"","time":"2026-09-08T06:41:37.770Z"}}
```

## 修改用户信息

- 发送消息

```json
{"action":"edituser","id":"user//test","email":"test123@qq.com"}

{"action":"edituser","id":"user//test","realname":"TEST"}
```

- 响应消息

```json
{"action":"event","event":{"etype":"user","userid":"user//admin","username":"admin","account":{"_id":"user//test","name":"test","creation":1788849697,"email":"test123@qq.com","passchange":1788849697,"realname":"TEST"},"action":"accountchange","msgid":66,"msgArgs":["test"],"msg":"Account changed: test","domain":"","time":"2026-09-08T06:43:31.015Z"}}
```
