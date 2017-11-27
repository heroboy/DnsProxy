interface Question
{
	name:string;
	type:string;
	class:number;
}

interface Answer
{
	name:string;
	type:string;
	class:number;
	ttl:number;
	flush:boolean?;
	data:any?;
}
