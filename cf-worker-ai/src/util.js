
let envVar = null

export function setEnvVar(newEnv) {
    envVar = newEnv
}

export function env() {
    return envVar
}

export function useEnv() {
    return async (c, next) => {
        setEnvVar(c.env)
        await next()
    }
}

export class ValidationError extends Error {
    constructor(message) {
        super(message && `Validation Error: ${message}` || 'Validation Error: missing required params')
        this.code = 400
    }
}


export class ResourceNotFoundError extends Error {
    constructor(message) {
        super(`Resource Not Found Error: ${message}`)
        this.code = 404
    }
}