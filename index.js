const PENDING = 'pending'
const FULFILLED = 'fulfilled'
const REJECTED = 'reject'

function asyncFun(callback) {
  if (!!process.nextTick) {
    return process.nextTick(callback)
  }
  else if (!!queueMicrotask) {
    return queueMicrotask(callback)
  } 
  else {
    return setTimeout(callback)
  }
}

class myPromise {
  constructor(executor) {
    // 判断是否是执行函数，非执行函数直接返回错误。
    this.PromiseResult = null
    this.PromiseState = PENDING
    this.onFulfilledCallbackStack = [] //保存成功回调
    this.onRejectedCallbackStack = [] //保存失败回调
    //执行resolve与reject函数
    try {
      executor(this.resolve.bind(this), this.reject.bind(this))
      // console.log(test)
    } catch (e) {
      this.reject(e)
    }
  }

  resolve(result) {
    if (this.PromiseState === PENDING) {
      this.PromiseState = FULFILLED
      this.PromiseResult = result
      //依次调用成功回调里面的所有回调
      this.onFulfilledCallbackStack.forEach(callback => {
        callback(result)
      })
    }
  }

  reject(error) {
    if (this.PromiseState === PENDING) {
      this.PromiseState = REJECTED
      this.PromiseResult = error
      this.onRejectedCallbackStack.forEach(callback => {
        callback(error)
      })
    }
  }

  /**
   * [注册fulfilled状态/rejected状态对应的回调函数]
   * @param {function} onFulfilled  fulfilled状态时 执行的函数
   * @param {function} onRejected  rejected状态时 执行的函数
   * @returns {function} newPromsie  返回一个新的promise对象
   */
  then(onFulfilled, onRejected) {
    let promise2 = new zwbPromise((resolve, reject) => {
      //遇到状态未改变时将回调函数放入回调栈，等待执行。
      if (this.PromiseState === PENDING) {
        this.onFulfilledCallbackStack.push(() => {
          //判断当前回调函数执行逻辑的执行函数，被压入异步队列中。注意，并不是回调函数被直接压入异步队列
          asyncFun(() => {
            try {
              if (typeof onFulfilled !== 'function') {
                resolve(this.PromiseResult)
              } else {
                let x = onFulfilled(this.PromiseResult)
                resolveMyPromise(promise2, x, resolve, reject)
              }
            } catch (e) {
              reject(e)
            }
          })
        })
        this.onRejectedCallbackStack.push(() => {
          asyncFun(() => {
            try {
              if (typeof onRejected !== 'function') {
                reject(this.PromiseResult)
              } else {
                let x = onRejected(this.PromiseResult)
                resolveMyPromise(promise2, x, resolve, reject)
              }
            } catch (e) {
              reject(e)
            }
          })
        })
      } else if (this.PromiseState === FULFILLED) {
        asyncFun(() => {
          try {
            if (typeof onFulfilled !== 'function') {
              resolve(this.PromiseResult)
            } else {
              let x = onFulfilled(this.PromiseResult)
              resolveMyPromise(promise2, x, resolve, reject)
            }
          } catch (e) {
            reject(e)
          }
        })
      } else if (this.PromiseState === REJECTED) {
        asyncFun(() => {
          try {
            if (typeof onRejected !== 'function') {
              reject(this.PromiseResult)
            } else {
              let x = onRejected(this.PromiseResult)
              resolveMyPromise(promise2, x, resolve, reject)
            }
          } catch (e) {
            reject(e)
          }
        })
      }
    })

    return promise2
  }
}

/**
 * 对resolve()、reject() 进行改造增强 针对resolve()和reject()中不同值情况 进行处理
 * @param  {promise} promise promise1.then方法返回的新的promise对象
 * @param  {[type]} x         promise1中onFulfilled或onRejected的返回值
 * @param  {[type]} resolve   promise2的resolve方法
 * @param  {[type]} reject    promise2的reject方法
 */
const resolveMyPromise = function(promise, x, resolve, reject) {
  //2.3.1规范，如果x与Promise指向同一个对象，则报循环调用错误。
  if (x === promise) {
    throw new TypeError('Chaining cycle detected for promise')
  }
  if (x instanceof myPromise) {
    //如果x是一个promise，则放入微任务队列等待执行x.then。如果执行的时候拿到一个y，则继续解析y。
    //延后两步的根因
    asyncFun(() => {
      x.then(y => {
        resolveMyPromise(promise, y, resolve, reject)
      }, reject)
    })
  } else if (x !== null && (typeof x === 'object' || typeof x === 'function')) {
    // 如果x是一个函数或者对象，只接受thenable的对象或函数
    try {
      var then = x.then
    } catch (e) {
      return reject(e)
    }

    if (typeof then === 'function') {
      let called = false // 防止重复调用
      try {
        then.call(
          x, //将x作为this指向
          y => {
            //以外部成功回调传入的参数为y值继续解析。
            if (called) return
            called = true
            resolveMyPromise(promise, y, resolve, reject)
          },
          z => {
            //以外部失败回调传入的参数为reject值。
            if (called) return
            called = true
            reject(z)
          },
        )
      } catch (e) {
        if (called) return
        called = true
        reject(e)
      }
    } else {
      resolve(x)
    }
  } else {
    return resolve(x)
  }
}

class zwbPromise extends myPromise {
  constructor(executor) {
    if (Object.prototype.toString.call(executor) === '[object Function]') {
      super(executor)
    } else {
      throw new TypeError('Promise resolver ' + executor + ' is not a function')
    }
  }
}

zwbPromise.deferred = function() {
  let result = {}
  result.promise = new zwbPromise((resolve, reject) => {
    result.resolve = resolve
    result.reject = reject
  })
  return result
}

module.exports = zwbPromise
