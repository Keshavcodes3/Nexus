import { Types } from "mongoose"


export const validate = (data: {
    name: string,
    description: string,
    ownerID: Types.ObjectId
}) => {
    if (!data.ownerID) throw new Error("owner id not found")
    if (!data.name || !data.description) throw new Error("Name and description needed")
}